#!/usr/bin/env node
/* 开发验证脚本：node tools/check.js [page-key ...]
   page-key ∈ ift | fsls | bridge | laplace（缺省 = 全部）。
   步骤 A 各 assets/*.js 语法检查；
   步骤 B 桩 DOM 中加载 common.js+ift.js，断言黎曼和数学性质（仅 ift）；
   步骤 C 每页注入探针后用无头 Chrome --dump-dom，确认无脚本错误、画布有布局、能重画；
   步骤 D 傅里叶反变换页截图像素扫描（仅 ift）。
   Chrome 路径可用环境变量 CHROME 覆盖。 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;

const PAGES = [
  { key: 'ift',    file: 'Fourier_inverse_transform_synthesis.html', js: 'assets/ift.js' },
  { key: 'fsls',   file: 'Fourier_series_linear_superposition.html', js: 'assets/fsls.js' },
  { key: 'bridge', file: 'From_Fourier_series_to_Fourier_transform.html', js: 'assets/bridge.js' },
  { key: 'laplace', file: 'Laplace_inverse_transform_synthesis.html', js: 'assets/laplace.js' },
];

/* —— 步骤 B 桩 DOM 配置：IFT 页侧栏控件 id 与加载期默认值（迁移时校准） —— */
const IFT_IDS = { pre: 'ePre', dw: 'eDw', tw: 'eTw', xw: 'eXw', tsl: 'eTsl' };
const IFT_SEED_VALUES = {};               // 形如 { eDw: '0.05' }；init 会自行写入的控件不必种
const IFT_SEED_CHECKED = { ckIdeal: true, ckEnv: true, ckRaw: false, ckLens: true, ckBrk: true, ck3d: false };
const IFT_EXPECT = {
  N: 160,
  chain0Re: 0.9210775031770956,
  curveMaxDev: 1e-12,
  sexpPhaseAtNegN: 0.7302,
  sexpPhaseAtPosN: 0.2698,
  regimeK: 2,
};

/* —— 步骤 D 像素扫描判据（区域相对画布矩形） —— */
const PIXEL = { green2Min: 150, purpleMin: 150, cyanMax: 20, grayLabMin: 40 };

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
const CHROME = process.env.CHROME || defaultChrome();

const results = [];
function report(status, name, detail) {
  results.push({ status, name, detail: detail || '' });
  console.log('[' + status + '] ' + name + (detail ? '  ' + detail : ''));
}

const wanted = process.argv.slice(2).filter(a => !a.startsWith('-'));
const selected = PAGES.filter(p => wanted.length === 0 || wanted.includes(p.key));
if (selected.length === 0) { console.error('unknown page keys: ' + wanted.join(',')); process.exit(2); }

/* ============ 步骤 A：语法 ============ */
function stepSyntax() {
  for (const p of selected) {
    const abs = path.join(ROOT, p.js);
    if (!fs.existsSync(abs)) { report('skip', 'syntax ' + p.js, '文件不存在（尚未迁移）'); continue; }
    const r = spawnSync(NODE, ['--check', abs], { encoding: 'utf8' });
    if (r.status === 0) report('ok', 'syntax ' + p.js);
    else report('FAIL', 'syntax ' + p.js, (r.stderr || '').trim().split('\n').slice(0, 4).join(' | '));
  }
  const common = path.join(ROOT, 'assets/common.js');
  if (fs.existsSync(common)) {
    const r = spawnSync(NODE, ['--check', common], { encoding: 'utf8' });
    report(r.status === 0 ? 'ok' : 'FAIL', 'syntax assets/common.js', r.status === 0 ? '' : (r.stderr || '').trim());
  }
}

/* ============ 步骤 B：桩 DOM + 数学断言（ift） ============ */
function makeStub() {
  const els = new Map();
  function ctxProxy(cvEl) {
    const store = {};
    return new Proxy(store, {
      get(t, prop) {
        if (prop in t) return t[prop];
        if (prop === 'canvas') return cvEl;
        if (prop === 'measureText') return function () { return { width: 10 }; };
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern')
          return function () { return { addColorStop: function () {} }; };
        if (prop === 'getImageData')
          return function (x, y, w, h) { return { data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }; };
        if (prop === 'then') return undefined;
        return function () {};
      },
      set(t, prop, v) { t[prop] = v; return true; },
    });
  }
  function mkEl(id) {
    return {
      id: id, tagName: 'DIV', style: {}, dataset: {}, children: [],
      checked: Object.prototype.hasOwnProperty.call(IFT_SEED_CHECKED, id) ? IFT_SEED_CHECKED[id] : false,
      value: Object.prototype.hasOwnProperty.call(IFT_SEED_VALUES, id) ? IFT_SEED_VALUES[id] : '',
      min: '0', max: '1', step: '0.01',
      textContent: '', innerHTML: '', className: '', title: '',
      clientWidth: 1242, clientHeight: 730, width: 300, height: 150,
      _ls: {},
      addEventListener: function (t, f) { (this._ls[t] = this._ls[t] || []).push(f); },
      removeEventListener: function () {},
      setAttribute: function () {}, getAttribute: function () { return null; },
      appendChild: function (c) { this.children.push(c); return c; },
      getBoundingClientRect: function () {
        return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight };
      },
      setPointerCapture: function () {}, releasePointerCapture: function () {},
      click: function () { (this._ls.click || []).forEach(f => f({ preventDefault: function () {}, clientX: 0, clientY: 0, button: 0 })); },
      focus: function () {}, blur: function () {},
      getContext: function () { return ctxProxy(this); },
      querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    };
  }
  const documentStub = {
    getElementById: function (id) { if (!els.has(id)) els.set(id, mkEl(id)); return els.get(id); },
    createElement: function (tag) { return mkEl('_created_' + tag); },
    addEventListener: function () {}, removeEventListener: function () {},
    querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    hidden: false,
    body: mkEl('body'),
  };
  const win = {
    document: documentStub,
    devicePixelRatio: 1,
    innerWidth: 1600, innerHeight: 900,
    addEventListener: function () {}, removeEventListener: function () {},
    matchMedia: function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; },
    requestAnimationFrame: function () { return 1; },
    cancelAnimationFrame: function () {},
    performance: { now: function () { return Date.now(); } },
    setTimeout: function () { return 0; }, clearTimeout: function () {},
    console: console,
  };
  win.window = win; win.self = win; win.globalThis = win;
  return { win: win, els: els };
}

function stepStubMath() {
  const p = PAGES.find(x => x.key === 'ift');
  if (!selected.includes(p)) return;
  const jsAbs = path.join(ROOT, p.js);
  if (!fs.existsSync(jsAbs)) { report('skip', 'stub-math ift', 'assets/ift.js 不存在（尚未迁移）'); return; }
  const commonSrc = fs.readFileSync(path.join(ROOT, 'assets/common.js'), 'utf8');
  const iftSrc = fs.readFileSync(jsAbs, 'utf8');
  const stub = makeStub();
  let H;
  try {
    const factory = new Function(
      'window', 'self', 'globalThis', 'document', 'performance',
      'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'setTimeout', 'clearTimeout',
      commonSrc + '\n;\n' + iftSrc + '\n;\nreturn window.__IFT;'
    );
    H = factory(stub.win, stub.win, stub.win, stub.win.document, stub.win.performance,
      stub.win.requestAnimationFrame, stub.win.cancelAnimationFrame, stub.win.matchMedia,
      stub.win.setTimeout, stub.win.clearTimeout);
  } catch (e) {
    report('FAIL', 'stub-math ift', '加载抛错: ' + e.message);
    return;
  }
  if (!H) { report('FAIL', 'stub-math ift', '未导出 window.__IFT'); return; }
  const bad = [];
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  if (!H.comp || H.comp.N !== IFT_EXPECT.N) bad.push('N=' + (H.comp && H.comp.N));
  const e0 = H.chainAt(0).end;
  if (!near(e0[0], IFT_EXPECT.chain0Re, 1e-9)) bad.push('chainAt(0).end[0]=' + e0[0]);
  const C = H.curve;
  if (C && C.re && C.t) {
    let maxd = 0;
    for (let i = 0; i < C.re.length; i++) maxd = Math.max(maxd, Math.abs(C.re[i] - H.sExact(C.t[i])));
    if (!(maxd < IFT_EXPECT.curveMaxDev)) bad.push('max|curve.re-sExact|=' + maxd);
  } else bad.push('curve 字段形状不符（re/t）');
  for (let n = -H.comp.N; n <= H.comp.N; n++) {
    if (H.phaseFrac(n) !== 0.5) { bad.push('dexp phaseFrac(' + n + ')=' + H.phaseFrac(n)); break; }
  }
  const reg = H.regime();
  if (!reg || reg.k !== IFT_EXPECT.regimeK) bad.push('regime.k=' + (reg && reg.k));
  /* 切到 sexp 预设：模拟 UI —— 改 select 值后触发 change（bind 里监听） */
  const sel = stub.els.get(IFT_IDS.pre);
  if (sel) {
    sel.value = 'sexp';
    (sel._ls.change || []).forEach(f => f({ target: sel }));
    const N2 = H.comp.N;
    const pm = H.phaseFrac(-N2), pp = H.phaseFrac(N2), p0 = H.phaseFrac(0);
    if (!near(pm, IFT_EXPECT.sexpPhaseAtNegN, 1e-3)) bad.push('sexp phaseFrac(-N)=' + pm);
    if (!near(pp, IFT_EXPECT.sexpPhaseAtPosN, 1e-3)) bad.push('sexp phaseFrac(N)=' + pp);
    if (!near(p0, 0.5, 1e-9)) bad.push('sexp phaseFrac(0)=' + p0);
  } else bad.push('找不到预设 select#' + IFT_IDS.pre);
  if (bad.length === 0) report('ok', 'stub-math ift', 'N/chain0/curve/phaseFrac/regime 全部符合');
  else report('FAIL', 'stub-math ift', bad.join('; '));
}

/* ============ 步骤 C：无头探针 ============ */
const PROBE_SNIPPET = `
<script>
(function(){
  var info='PROBE';
  try{
    var cv=document.getElementById('cv');
    var r=cv?cv.getBoundingClientRect():null;
    info+=' cv='+(r?Math.round(r.width)+'x'+Math.round(r.height)+'@'+Math.round(r.left)+','+Math.round(r.top):'none');
    var eb=document.getElementById('errbar');
    info+=' err='+(eb&&eb.classList&&eb.classList.contains('on')?'1':'0');
    var h=window.__VIZ;
    info+=' viz='+(h?'1':'0');
    if(h&&h.st&&h.draw){ h.st.playing=false; h.draw(); info+=' draw=ok'; }
  }catch(e){ info+=' throw='+e.message; }
  document.title=info;
})();
</script>
`;

function probePage(p) {
  const html = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
  const i = html.lastIndexOf('</body>');
  if (i < 0) return { status: 'FAIL', detail: '无 </body>' };
  const tmp = path.join(ROOT, '_probe_' + p.key + '.html');
  fs.writeFileSync(tmp, html.slice(0, i) + PROBE_SNIPPET + html.slice(i), 'utf8');
  try {
    const url = 'file:///' + tmp.replace(/\\/g, '/');
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--window-size=1600,900',
      '--virtual-time-budget=3000', '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 90000 });
    const dom = r.stdout || '';
    const m = dom.match(/<title>([\s\S]*?)<\/title>/);
    const title = m ? m[1] : '';
    if (!/^PROBE/.test(title)) return { status: 'FAIL', detail: 'title 未写入: ' + title.slice(0, 120) };
    const rectM = title.match(/cv=(\d+)x(\d+)@(-?\d+),(-?\d+)/);
    const rect = rectM ? { width: +rectM[1], height: +rectM[2], left: +rectM[3], top: +rectM[4] } : null;
    const viz = /viz=1/.test(title);
    const err = /err=1/.test(title);
    const threw = title.match(/throw=([^ ]*)/);
    const drawOk = /draw=ok/.test(title);
    if (!rect || rect.width < 400 || rect.height < 300) return { status: 'FAIL', detail: '画布布局异常 ' + title };
    if (err) return { status: 'FAIL', detail: '错误横幅亮起 ' + title };
    if (threw) return { status: 'FAIL', detail: '探针抛错 ' + threw[1] };
    if (!viz) return { status: 'skip', detail: '未迁移（无 __VIZ 句柄） ' + title, rect: rect, viz: false };
    if (!drawOk) return { status: 'FAIL', detail: 'draw 失败 ' + title };
    return { status: 'ok', detail: title, rect: rect, viz: true };
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
  }
}

function stepProbes() {
  if (!CHROME) { report('skip', 'probe *', '未找到 Chrome，设 CHROME 环境变量可启用'); return; }
  for (const p of selected) {
    if (!fs.existsSync(path.join(ROOT, p.file))) { report('skip', 'probe ' + p.key, '页面不存在'); continue; }
    const r = probePage(p);
    report(r.status, 'probe ' + p.key, r.detail);
    if (r.rect) lastRect[p.key] = r.rect;
    lastViz[p.key] = !!r.viz;
  }
}
const lastRect = {};
const lastViz = {};

/* ============ 步骤 D：像素扫描（ift） ============ */
function readPng(file) {
  const buf = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bd !== 8) throw new Error('unsupported bit depth ' + bd);
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 0 ? 1 : ct === 4 ? 2 : 0;
  if (!ch) throw new Error('unsupported color type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const rv = raw[pos + x];
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = y > 0 && x >= ch ? out[(y - 1) * stride + x - ch] : 0;
      let v;
      if (f === 0) v = rv;
      else if (f === 1) v = rv + a;
      else if (f === 2) v = rv + b;
      else if (f === 3) v = rv + ((a + b) >> 1);
      else if (f === 4) v = rv + paeth(a, b, c);
      else throw new Error('bad filter ' + f);
      out[y * stride + x] = v & 255;
    }
    pos += stride;
  }
  return { w: w, h: h, ch: ch, data: out };
}

function scanPixels(png, rect) {
  const T = Math.round(rect.top), L = Math.round(rect.left);
  const CW = Math.round(rect.width), CH = Math.round(rect.height);
  const topH = Math.round(CH * 0.55);
  const sw = Math.round((CW - 42) * 0.55);
  let green2 = 0, purple = 0, cyan = 0, grayLab = 0;
  const at = (x, y) => (y * png.w + x) * png.ch;
  for (let y = T + topH + 60; y < Math.min(T + CH - 6, png.h); y++) {
    for (let x = Math.max(0, L); x < Math.min(L + CW, png.w); x++) {
      const o = at(x, y), r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (g > 90 && g - r > 25 && g - b > 10) green2++;
    }
    for (let x = Math.max(0, L + 10); x < Math.min(L + 34, png.w); x++) {
      const o = at(x, y), r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (Math.abs(r - 143) < 30 && Math.abs(g - 162) < 30 && Math.abs(b - 196) < 30) grayLab++;
    }
  }
  for (let y = Math.max(0, T + 26); y < Math.min(T + topH - 14, png.h); y++) {
    for (let x = Math.max(0, L + 14); x < Math.min(L + 14 + sw, png.w); x++) {
      const o = at(x, y), r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (b > 190 && r > 90 && r < 200 && g < 130) purple++;
      if (g > 150 && b > 150 && r < 120) cyan++;
    }
  }
  return { green2: green2, purple: purple, cyan: cyan, grayLab: grayLab };
}

function stepPixels() {
  const p = PAGES.find(x => x.key === 'ift');
  if (!selected.includes(p) || !CHROME) return;
  const rect = lastRect.ift;
  if (!rect) { report('skip', 'pixels ift', '无画布矩形（探针未过）'); return; }
  if (!lastViz.ift) { report('skip', 'pixels ift', '未迁移（无 __VIZ 句柄）'); return; }
  const html = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
  const i = html.lastIndexOf('</body>');
  const tmpHtml = path.join(ROOT, '_shot_ift.html');
  const tmpPng = path.join(os.tmpdir(), 'ift_shot_' + process.pid + '.png');
  fs.writeFileSync(tmpHtml, html.slice(0, i) + PROBE_SNIPPET + html.slice(i), 'utf8');
  try {
    const url = 'file:///' + tmpHtml.replace(/\\/g, '/');
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--window-size=1600,900',
      '--run-all-compositor-stages-before-draw', '--virtual-time-budget=4000',
      '--screenshot=' + tmpPng, url], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0 || !fs.existsSync(tmpPng)) { report('FAIL', 'pixels ift', '截图失败 ' + (r.stderr || '').slice(0, 200)); return; }
    const png = readPng(tmpPng);
    const s = scanPixels(png, rect);
    const bad = [];
    if (s.green2 <= PIXEL.green2Min) bad.push('green2=' + s.green2);
    if (s.purple <= PIXEL.purpleMin) bad.push('purple=' + s.purple);
    if (s.cyan >= PIXEL.cyanMax) bad.push('cyan=' + s.cyan);
    if (s.grayLab <= PIXEL.grayLabMin) bad.push('grayLab=' + s.grayLab);
    const detail = 'green2=' + s.green2 + ' purple=' + s.purple + ' cyan=' + s.cyan + ' grayLab=' + s.grayLab;
    report(bad.length === 0 ? 'ok' : 'FAIL', 'pixels ift', detail + (bad.length ? '  不符: ' + bad.join(',') : ''));
  } catch (e) {
    report('FAIL', 'pixels ift', e.message);
  } finally {
    try { fs.unlinkSync(tmpHtml); } catch (e) { /* ignore */ }
    try { fs.unlinkSync(tmpPng); } catch (e) { /* ignore */ }
  }
}

stepSyntax();
stepStubMath();
stepProbes();
stepPixels();

const failed = results.filter(r => r.status === 'FAIL');
console.log(failed.length === 0 ? '\nALL CHECKS PASSED (' + results.length + ' items)' : '\nFAILED: ' + failed.length + ' items');
process.exit(failed.length === 0 ? 0 : 1);
