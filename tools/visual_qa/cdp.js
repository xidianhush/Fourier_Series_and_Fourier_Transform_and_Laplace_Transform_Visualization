/* 极简 CDP（Chrome DevTools Protocol）浏览器驱动，零 npm 依赖。
   依赖 Node >= 22 自带的全局 WebSocket / fetch，只用内置模块。
   用法：
     const { launch } = require('./cdp.js');
     const browser = await launch({ width: 1440, height: 900 });
     const page = await browser.newPage();
     await page.goto('file:///...');
     await page.shot('out/a.png', { fullPage: true });
     await page.close();
     await browser.kill();
   Chrome 路径用环境变量 CHROME 覆盖，缺省按常见安装路径探测（与
   fs_inv_ft_inv_laplace/tools/check.js 的 defaultChrome() 同一候选清单）。 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const WS_WAIT_MS = 60000;   // 等 Chrome 打印 DevTools ws 地址的上限
const CMD_TIMEOUT_MS = 60000;

function defaultChrome() {
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Chromium/Application/chrome.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  for (const c of cands) { try { fs.accessSync(c); return c; } catch (e) { /* try next */ } }
  return null;
}

/* key() 支持的按键表：key → {key, code, windowsVirtualKeyCode} */
const KEYS = {
  Enter: { key: 'Enter', code: 'Enter', vk: 13 },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  Tab: { key: 'Tab', code: 'Tab', vk: 9 },
  Backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
  Delete: { key: 'Delete', code: 'Delete', vk: 46 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  Home: { key: 'Home', code: 'Home', vk: 36 },
  End: { key: 'End', code: 'End', vk: 35 },
  PageUp: { key: 'PageUp', code: 'PageUp', vk: 33 },
  PageDown: { key: 'PageDown', code: 'PageDown', vk: 34 },
  ' ': { key: ' ', code: 'Space', vk: 32 },
  Space: { key: ' ', code: 'Space', vk: 32 },
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ================= Browser ================= */

class Browser {
  constructor(child, ws, profileDir) {
    this.child = child;
    this.ws = ws;
    this.profileDir = profileDir;
    this.nextId = 1;
    this.pending = new Map();       // id → {resolve, reject, timer}
    this.sessionListeners = new Map(); // sessionId → Map<method, Set<fn>>
    this.killed = false;

    ws.addEventListener('message', ev => {
      const data = typeof ev.data === 'string' ? ev.data : String(ev.data);
      let msg;
      try { msg = JSON.parse(data); } catch (e) { return; }
      this._onMessage(msg);
    });
    ws.addEventListener('close', () => this._failAll(new Error('CDP WebSocket closed')));
    ws.addEventListener('error', () => { /* close 事件随后兜底 */ });

    this._exitHook = () => { try { child.kill(); } catch (e) { /* 已经退出 */ } };
    process.on('exit', this._exitHook);
  }

  _failAll(err) {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(err); }
    this.pending.clear();
  }

  _onMessage(msg) {
    if (msg.id != null) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.message + (msg.error.data ? ' | ' + msg.error.data : '')));
      else p.resolve(msg.result || {});
      return;
    }
    if (msg.method && msg.sessionId) {
      const table = this.sessionListeners.get(msg.sessionId);
      const set = table && table.get(msg.method);
      if (set) for (const fn of [...set]) { try { fn(msg.params || {}); } catch (e) { /* 监听器自负 */ } }
    }
  }

  /* 发送一条 CDP 命令；sessionId 为空则发给浏览器级目标 */
  send(method, params, sessionId) {
    if (this.killed) return Promise.reject(new Error('browser already killed'));
    const id = this.nextId++;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('CDP command timeout: ' + method));
      }, CMD_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      try { this.ws.send(JSON.stringify(payload)); }
      catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }

  _listen(sessionId, method, fn) {
    let table = this.sessionListeners.get(sessionId);
    if (!table) { table = new Map(); this.sessionListeners.set(sessionId, table); }
    let set = table.get(method);
    if (!set) { set = new Set(); table.set(method, set); }
    set.add(fn);
  }

  _unlisten(sessionId, method, fn) {
    const table = this.sessionListeners.get(sessionId);
    const set = table && table.get(method);
    if (set) set.delete(fn);
  }

  /* 新开一个 target 并附加为页面级 session */
  async newPage(opts) {
    const width = (opts && opts.width) || 1440;
    const height = (opts && opts.height) || 900;
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, targetId, sessionId, width, height);
    await page._init();
    return page;
  }

  /* kill chrome 进程并清理临时 profile 目录（幂等） */
  async kill() {
    if (this.killed) return;
    this.killed = true;
    process.removeListener('exit', this._exitHook);
    try { this.ws.close(); } catch (e) { /* 已关闭 */ }
    try { this.child.kill(); } catch (e) { /* 已退出 */ }
    await new Promise(resolve => {
      const t = setTimeout(resolve, 5000);
      this.child.once('exit', () => { clearTimeout(t); resolve(); });
    });
    this._failAll(new Error('browser killed'));
    try { fs.rmSync(this.profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
    catch (e) { /* 清理失败不致命 */ }
  }
}

/* ================= Page ================= */

class Page {
  constructor(browser, targetId, sessionId, width, height) {
    this.browser = browser;
    this.targetId = targetId;
    this.sessionId = sessionId;
    this.width = width;
    this.height = height;
    this.consoleLog = [];   // {level, text}，收集 console.error/warning 与未捕获异常
    this.closed = false;
  }

  async _init() {
    const b = this.browser, sid = this.sessionId;
    // 设备指标覆盖比 --window-size 更可靠
    await b.send('Emulation.setDeviceMetricsOverride',
      { width: this.width, height: this.height, deviceScaleFactor: 1, mobile: false }, sid);
    await b.send('Page.enable', {}, sid);
    await b.send('Runtime.enable', {}, sid);
    await b.send('Log.enable', {}, sid);

    const pushLog = (level, text) => {
      if (this.consoleLog.length < 300) this.consoleLog.push({ level, text });
    };
    b._listen(sid, 'Runtime.consoleAPICalled', p => {
      if (p.type !== 'error' && p.type !== 'warning') return;
      const text = (p.args || []).map(a => {
        if (a == null) return '';
        if (a.value !== undefined) return String(a.value);
        return a.description || a.unserializableValue || a.type || '';
      }).join(' ');
      pushLog(p.type, text);
    });
    b._listen(sid, 'Runtime.exceptionThrown', p => {
      const d = p.exceptionDetails || {};
      const ex = d.exception || {};
      pushLog('exception', (d.text || '') + (ex.description ? ' | ' + ex.description : ''));
    });
    b._listen(sid, 'Log.entryAdded', p => {
      const e = p.entry || {};
      if (e.level !== 'error' && e.level !== 'warning') return;
      pushLog(e.level, (e.text || '') + (e.url ? ' | ' + e.url : ''));
    });
  }

  _send(method, params) {
    if (this.closed) return Promise.reject(new Error('page already closed'));
    return this.browser.send(method, params, this.sessionId);
  }

  /* 等某个页面级事件一次；超时 resolve(null) */
  _waitEvent(method, timeoutMs) {
    return new Promise(resolve => {
      const b = this.browser, sid = this.sessionId;
      const timer = setTimeout(() => { b._unlisten(sid, method, fn); resolve(null); }, timeoutMs);
      const fn = params => {
        clearTimeout(timer);
        b._unlisten(sid, method, fn);
        resolve(params);
      };
      b._listen(sid, method, fn);
    });
  }

  /* 导航并等 Page.loadEventFired；30s 超时不抛死、返回 false */
  async goto(url) {
    const loaded = this._waitEvent('Page.loadEventFired', 30000);
    await this._send('Page.navigate', { url });
    return (await loaded) != null;
  }

  /* 在当前页面求值；页面抛异常时把 exception 文本抛出 */
  async evalJs(expression) {
    const r = await this._send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      const ex = d.exception || {};
      throw new Error('page exception: ' + (d.text || '') + (ex.description ? ' | ' + ex.description : ''));
    }
    return r.result ? r.result.value : undefined;
  }

  /* 轮询 evalJs 直到真值或超时返回 false */
  async waitFor(jsBoolExpr, timeoutMs, pollMs) {
    const poll = pollMs || 200;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try { if (await this.evalJs(jsBoolExpr)) return true; } catch (e) { /* 导航中等瞬态错误 */ }
      await sleep(poll);
    }
    try { return !!(await this.evalJs(jsBoolExpr)); } catch (e) { return false; }
  }

  /* 截图落盘（自动建目录）。opts.fullPage / opts.clip={x,y,width,height} */
  async shot(filePath, opts) {
    const params = { format: 'png' };
    if (opts && opts.fullPage) params.captureBeyondViewport = true;
    if (opts && opts.clip) {
      params.clip = { x: opts.clip.x, y: opts.clip.y, width: opts.clip.width, height: opts.clip.height, scale: 1 };
      params.captureBeyondViewport = true;
    }
    const r = await this._send('Page.captureScreenshot', params);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(r.data, 'base64'));
    return filePath;
  }

  async _mouse(type, x, y, extra) {
    await this._send('Input.dispatchMouseEvent', Object.assign({ type, x, y }, extra || {}));
  }

  async click(x, y) {
    await this._mouse('mousePressed', x, y, { button: 'left', clickCount: 1 });
    await this._mouse('mouseReleased', x, y, { button: 'left', clickCount: 1 });
  }

  async dblclick(x, y) {
    await this._mouse('mousePressed', x, y, { button: 'left', clickCount: 1 });
    await this._mouse('mouseReleased', x, y, { button: 'left', clickCount: 1 });
    await this._mouse('mousePressed', x, y, { button: 'left', clickCount: 2 });
    await this._mouse('mouseReleased', x, y, { button: 'left', clickCount: 2 });
  }

  async drag(x1, y1, x2, y2, steps) {
    const n = steps || 10;
    await this._mouse('mousePressed', x1, y1, { button: 'left', clickCount: 1 });
    for (let i = 1; i <= n; i++) {
      const x = x1 + (x2 - x1) * i / n;
      const y = y1 + (y2 - y1) * i / n;
      await this._mouse(i === n ? 'mouseReleased' : 'mouseMoved', x, y,
        i === n ? { button: 'left', clickCount: 1 } : { button: 'left' });
    }
  }

  async typeText(text) {
    await this._send('Input.insertText', { text });
  }

  /* 按键；modifiers 是 CDP 位掩码（Alt=1, Ctrl=2, Meta=4, Shift=8），如 key('a', 2) = Ctrl+A */
  async key(name, modifiers) {
    let k = KEYS[name];
    if (!k && typeof name === 'string' && name.length === 1) {
      const up = name.toUpperCase();
      k = { key: name, code: /[A-Z]/.test(up) ? 'Key' + up : '', vk: up.charCodeAt(0) };
    }
    if (!k) throw new Error('unsupported key: ' + name);
    const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk };
    if (modifiers) base.modifiers = modifiers;
    await this._send('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, base));
    await this._send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
  }

  async scroll(dx, dy) {
    await this._mouse('mouseWheel', this.width / 2, this.height / 2, { deltaX: dx, deltaY: dy });
  }

  async url() { return this.evalJs('location.href'); }

  /* 关闭本 target；浏览器进程由 browser.kill() 统一收尾 */
  async close() {
    if (this.closed) return;
    this.closed = true;
    try { await this.browser.send('Target.closeTarget', { targetId: this.targetId }); }
    catch (e) { /* 目标可能已自行关闭 */ }
  }
}

/* ================= launch ================= */

/* 启动 Chrome 并连上浏览器级 WebSocket。
   opts: { width, height, headed, chromePath } */
async function launch(opts) {
  opts = opts || {};
  const chromePath = opts.chromePath || process.env.CHROME || defaultChrome();
  if (!chromePath) throw new Error('chrome not found; set CHROME env var');

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  const args = [];
  if (!opts.headed) args.push('--headless=new');
  args.push(
    '--remote-debugging-port=0',
    '--user-data-dir=' + profileDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    '--window-size=' + (opts.width || 1440) + ',' + (opts.height || 900),
    'about:blank',
  );

  const child = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  child.on('error', () => { /* 由 ws 等待超时统一报错 */ });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => {
      cleanup();
      try { child.kill(); } catch (e) { /* noop */ }
      reject(new Error('chrome did not print DevTools ws url within ' + WS_WAIT_MS / 1000 + 's'));
    }, WS_WAIT_MS);
    const onData = chunk => {
      buf += chunk.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { cleanup(); resolve(m[1]); }
    };
    const cleanup = () => { clearTimeout(timer); child.stderr.removeListener('data', onData); };
    child.stderr.on('data', onData);   // stderr 里会有 GPU 噪音行，正则只认 DevTools 那行
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket open timeout')), 15000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket connect failed: ' + wsUrl)); }, { once: true });
  });

  return new Browser(child, ws, profileDir);
}

module.exports = { launch, defaultChrome, Browser, Page };
