#!/usr/bin/env node
/* 视觉模型驱动的浏览器功能巡检：
   node tools/visual_qa/agent.js [itemId|pageKey ...] [--max-turns N=12] [--max-calls N=200]
                                 [--model M] [--headed] [--list] [--dry-run]
   每个功能点独立：新开 page(1440×900) → goto → 就绪等待（同 shot.js 规则）→ 循环
   「视口截图 → qwen.chat → parseAction → 执行动作 → 安全栏检查」，done 或 maxTurns 退出。
   坐标一律 0–1000 归一化。transcript 写 out/qa/<item.id>/transcript.json，
   汇总写 out/qa/report.json；任一 fail 退出码 1。
   --list 只列清单；--dry-run 只走「开页→就绪→首张截图→打印首轮 prompt」，不调 API。 */
'use strict';

const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');
const { launch } = require('./cdp.js');
const qwen = require('./qwen.js');
const CHECKLIST = require('./checklist.js');
const { REPO_ROOT, PAGES, sleep, fileUrl, waitReady } = require('./readiness.js');

const OUT_ROOT = path.join(__dirname, 'out', 'qa');
const VIEW_W = 1440, VIEW_H = 900;

const SYSTEM_PROMPT = [
  '你是网页功能巡检员，负责巡检一个英文 UI 的《信号与系统》教学可视化网站（本地静态页面，画布内容是 Canvas 绘制的数学图形）。',
  '每轮你会收到：巡检目标、通过标准、页面控件清单（含归一化坐标）、最近几步动作历史、以及当前视口截图。',
  '你只允许回复一个 JSON 动作对象，不要输出任何多余文字（不要解释、不要 markdown 围栏以外的内容）。',
  '坐标一律用 0–1000 归一化：x 向右、y 向下，(0,0) 是视口左上角，(1000,1000) 是右下角。',
  '动作集：',
  '{"action":"click","x":123,"y":456,"why":"..."}',
  '{"action":"type","x":..,"y":..,"text":"要输入的文本","why":"..."}   // 系统会先点击该坐标、全选、再输入',
  '{"action":"key","key":"Enter","why":"..."}   // 支持 Enter/Escape/Tab/Backspace/Delete/ArrowLeft/ArrowRight/ArrowUp/ArrowDown',
  '{"action":"scroll","dx":0,"dy":600,"why":"..."}   // dy>0 页面向下滚',
  '{"action":"drag","x1":..,"y1":..,"x2":..,"y2":..,"why":"..."}   // 拖滑块、拖画布视角都用它',
  '{"action":"find","target":"#元素id","why":"..."}   // 把屏外元素（章节容器、画布、控件都可以）滚进视口，结果会返回它的新中心坐标',
  '{"action":"select","target":"#下拉框id","value":"选项value","why":"..."}   // 下拉框必须用这个，不要点击原生弹层（合成点击会穿透误触下层控件）',
  '{"action":"back","why":"..."}   // 返回上一页（点了卡片/链接跳转后用它回来）',
  '{"action":"done","verdict":"pass","reason":"...","why":"..."}   // verdict 也可以是 "fail"',
  '规则：',
  '- 只有确认【通过标准】全部在截图中可见地满足时才回 done pass；明确不满足就回 done fail 并在 reason 里写清哪条不满足。',
  '- 下拉框(select)一律用 select 动作直接设值（option 的 value 见控件清单 options=[...]）；其它元素用 click。',
  '- 结论只能以 done 动作给出：在 why 里写"已满足/可判定通过"但继续做其它动作 = 未完成，纯属浪费轮数。',
  '- 每步只做一件事，等下一轮截图更新后再判断效果；不要重复已经成功的动作。',
  '- 按钮上的文字表示"点击后将执行的动作"，不是当前状态：显示 "⏸ Pause" = 正在播放（点击会暂停）；显示 "▶ Play" = 已暂停（点击会播放）。',
  '- 验证要果断：同一现象最多验证 2 次（点 1 次 + 对比前后两张截图）。确认满足通过标准后立即 done，禁止用重复点击反复确认同一个变化。',
  '- 判断"是否在动"时，优先对比数字读数（t、T、σ 等）在两张截图间的数值差异，比看图形更可靠。',
  '- 点击按钮/控件时，必须使用【页面控件】清单里给出的中心坐标（直接照抄 x,y），不要凭截图目测估计；只有清单里没有的目标（如画布内部）才允许目测。坐标超出 0–1000 会被拒绝。',
  '- 每次点击后，动作结果里会带"命中: xxx"告诉你实际点到了什么元素；若没命中目标，下一轮用清单坐标修正。',
  '- 长页面一屏看不完：滚动位置见【驱动实测状态】的"滚动=当前/总高"。分页确认完所有目标内容后即可下结论，不要求所有证据出现在同一屏。',
  '- 动画类页面：你思考的几秒里动画一直在走，播放状态下两张截图可能差异很大甚至读数跳变，这是正常的；判断"播放/暂停"用【驱动对比】的结论，不要纠结差异的大小和方向。',
  '- 【最近动作】历史是已发生事实的可靠记录：如果历史里已经完成目标要求的全部步骤（包括"切换后再切回"这类往返步骤），立即 done——历史就是证据，不要为"再确认一遍"而重做。',
  '- 不要刷新页面，不要导航到仓库以外的地址，不要猜测截图里看不到的东西。',
].join('\n');

/* ---------- CLI ---------- */
function parseArgs(argv) {
  const opts = { maxTurns: null, maxCalls: 200, model: null, headed: false, list: false, dryRun: false, select: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max-turns') opts.maxTurns = parseInt(argv[++i], 10) || opts.maxTurns;
    else if (a === '--max-calls') opts.maxCalls = parseInt(argv[++i], 10) || opts.maxCalls;
    else if (a === '--model') opts.model = argv[++i] || null;
    else if (a === '--headed') opts.headed = true;
    else if (a === '--list') opts.list = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (!a.startsWith('-')) opts.select.push(a);
  }
  return opts;
}

function selectItems(sel) {
  if (sel.length === 0) return CHECKLIST;
  const out = [];
  for (const token of sel) {
    const hit = CHECKLIST.filter(it => it.id === token || it.page === token);
    if (hit.length === 0) { console.error('unknown item/page: ' + token); process.exit(2); }
    for (const it of hit) if (!out.includes(it)) out.push(it);
  }
  return out;
}

/* ---------- 控件枚举（按钮/输入框/下拉/链接，归一化坐标） ---------- */
const ENUM_JS = `(function(){
  var out = [];
  document.querySelectorAll('button, input, select, textarea, a[href]').forEach(function(el){
    var r = el.getBoundingClientRect();
    if (r.width < 5 || r.height < 5) return;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    /* 屏外元素（含 overflow 侧栏里被卷走的）也列出但标记 off——让模型知道它存在、先 find 再点 */
    var off = (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth);
    var text = '';
    if (el.tagName === 'SELECT') {
      text = 'select value=' + JSON.stringify(el.value) + ' options=[' +
        Array.from(el.options).map(function(o){ return o.text.trim(); }).join(' | ').slice(0, 150) + ']';
    } else if (el.tagName === 'INPUT') {
      text = el.type || 'text';
      if (el.type === 'checkbox' || el.type === 'radio') text += el.checked ? ' checked' : ' unchecked';
      else if (el.value !== undefined && el.type !== 'button') text += ' value=' + JSON.stringify(String(el.value)).slice(0, 60);
    } else if (el.tagName === 'TEXTAREA') {
      text = 'textarea value=' + JSON.stringify(el.value).slice(0, 60);
    } else {
      text = JSON.stringify((el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60));
    }
    var label = '';
    if (el.id) { var lb = document.querySelector('label[for="' + el.id + '"]'); if (lb) label = lb.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40); }
    if (!label && el.parentElement && el.parentElement.tagName === 'LABEL') label = el.parentElement.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40);
    out.push({
      tag: el.tagName.toLowerCase(), id: el.id || '', text: text, label: label,
      disabled: !!el.disabled,
      off: off || undefined,
      x: off ? null : Math.round((r.left + r.width / 2) / innerWidth * 1000),
      y: off ? null : Math.round((r.top + r.height / 2) / innerHeight * 1000),
    });
  });
  return out.slice(0, 80);
})()`;

/* 每轮从页面直读的客观状态（比模型的截图记忆可靠）：
   播放按钮文本、t 类滑块值、__VIZ.st.t。供 prompt 注入与"动/停"判定。 */
const DIGEST_JS = `(function(){
  var b = document.getElementById('play') || document.getElementById('animPlayBtn');
  var r = document.querySelector('input#tsl, input#animFrame, input#logT');
  var sg = document.querySelector('input#sig, input#sigmaSlider, input#animSigma');
  var t = (window.__VIZ && __VIZ.st && typeof __VIZ.st.t === 'number') ? __VIZ.st.t : null;
  return JSON.stringify({
    btn: b ? b.textContent.replace(/\\s+/g, ' ').trim() : null,
    slider: r ? r.value : null,
    sig: sg ? sg.value : null,
    t: t === null ? null : Math.round(t * 1000) / 1000,
    scroll: Math.round(window.scrollY) + '/' + Math.round(document.documentElement.scrollHeight)
  });
})()`;

function fmtDigest(d) {
  if (!d) return '不可用';
  let o = d;
  try { if (typeof o === 'string') o = JSON.parse(o); } catch (e) { return String(d); }
  return '播放按钮文本="' + (o.btn || '无') + '" 滑块值=' + (o.slider == null ? '无' : o.slider) +
    (o.sig == null ? '' : ' σ=' + o.sig) +
    (o.t == null ? '' : ' t=' + o.t) + (o.scroll ? ' 滚动位置=' + o.scroll : '');
}

/* 坐标越界校验（实测模型会输出 x=1503 这类越界值并逐轮放大）。返回 null = 合法。 */
function coordErr(act) {
  const bad = (v) => { const n = Number(v); return !isFinite(n) || n < 0 || n > 1000; };
  if (act.action === 'click' || act.action === 'type') {
    if (bad(act.x) || bad(act.y)) return 'x/y 必须在 0–1000 内（收到 x=' + act.x + ', y=' + act.y + '）。目标控件的中心坐标见【页面控件】清单，直接照抄。';
  }
  if (act.action === 'drag') {
    if (bad(act.x1) || bad(act.y1) || bad(act.x2) || bad(act.y2)) return 'drag 的 x1/y1/x2/y2 必须在 0–1000 内。';
  }
  return null;
}

/* 相邻两轮 digest 的差分结论——模型跨轮记忆数字不可靠，由驱动把"变了/没变"算好。
   （实测 qwen3-vl-flash 会把冻结的 t 记成变化的，反复验证播放键陷入死循环。） */
function digestDelta(prev, cur) {
  if (!prev || !cur) return null;
  try {
    const p = JSON.parse(prev), c = JSON.parse(cur);
    const parts = [];
    if (p.t != null && c.t != null) {
      parts.push('t: ' + p.t + ' → ' + c.t + (p.t === c.t ? '（未变化 = 画面静止/已暂停）' : '（变化了 = 在播放）'));
    }
    if (p.slider != null && c.slider != null) {
      parts.push('滑块值: ' + p.slider + ' → ' + c.slider + (String(p.slider) === String(c.slider) ? '（未变）' : '（变了）'));
    }
    if (p.sig != null && c.sig != null) {
      parts.push('σ: ' + p.sig + ' → ' + c.sig + (String(p.sig) === String(c.sig) ? '（未变）' : '（变了）'));
    }
    parts.push(p.btn === c.btn ? '按钮文本不变: "' + c.btn + '"' : '按钮文本: "' + p.btn + '" → "' + c.btn + '"');
    return parts.join('；');
  } catch (e) { return null; }
}

function fmtControls(list) {
  if (!list || list.length === 0) return '（当前视口没有枚举到控件）';
  return list.map(c => {
    let s = '- ' + c.tag + (c.id ? ' #' + c.id : '') + ' ' + c.text;
    if (c.label) s += ' [label: ' + c.label + ']';
    if (c.disabled) s += ' [disabled]';
    if (c.off) s += c.id ? '（屏外：先 {"action":"find","target":"#' + c.id + '"} 再点击）' : '（屏外）';
    else s += ' 中心(' + c.x + ',' + c.y + ')';
    return s;
  }).join('\n');
}

/* 重复动作刹车：同位置连点 ≥3 次、连拖 ≥3 次、连切 select ≥3 次都注入警告。
   （实测 qwen3-vl-flash 会陷入"播放键来回点"、"滑块追虚构目标值"、"select 循环"等死循环。） */
function antiLoopNote(history) {
  const last = history.slice(-3);
  if (last.length < 3) return null;
  const acts = last.map(h => h.action);
  if (acts.every(a => a === 'click')) {
    const pts = last.map(h => { const m = (h.result || '').match(/^clicked\((\d+),(\d+)\)/); return m && [+m[1], +m[2]]; });
    if (pts.every(p => p) && pts.every(p => Math.abs(p[0] - pts[0][0]) <= 40 && Math.abs(p[1] - pts[0][1]) <= 40)) {
      return '【系统警告】你已经连续 3 次点击几乎同一个位置。禁止再重复：回顾已观察到的变化（按钮文字、读数差异），立即用 done 给出结论，或换一个完全不同的动作。';
    }
    return null;
  }
  if (acts.every(a => a === 'drag')) {
    return '【系统警告】你已经连续拖动 3 次。若读数已变化（见【驱动对比】），目标即已达成：立即 done，不要为追求某个特定数值而继续拖。';
  }
  if (acts.every(a => a === 'select')) {
    return '【系统警告】你已经连续切换 3 次下拉框。切换是否成功以 select 结果的 "ok value=…" 为准：已成功就立即 done，不要重复切换。';
  }
  return null;
}

/* ---------- 首轮 prompt 文本（dry-run 与真跑共用） ---------- */
function buildUserText(item, controls, history, digest) {
  const hist = history.length === 0 ? '（这是第一步，还没有历史动作）'
    : history.slice(-4).map(h => h.turn + '. ' + h.action + ' — ' + (h.why || '') + ' → ' + h.result +
      (h.state ? '（当时实测: ' + fmtDigest(h.state) + '）' : '')).join('\n');
  const lines = [
    '【巡检项】' + item.id + '：' + item.title,
    '【目标】' + item.goal,
    '【通过标准】' + item.passCriteria,
    '【驱动实测状态】（每轮从页面直读，比你的截图记忆更可信，判断按钮文字/滑块值/t 时以此为准）当前: ' + fmtDigest(digest),
  ];
  const prevState = history.length > 0 ? history[history.length - 1].state : null;
  const delta = digestDelta(prevState, digest);
  if (delta) lines.push('【驱动对比】（上一轮 → 本轮，结论已算好，直接采信）' + delta);
  lines.push(
    '【页面控件】（tag #id 文本/状态 中心坐标，坐标系与截图一致）',
    fmtControls(controls),
    '【最近动作】',
    hist,
  );
  const note = antiLoopNote(history);
  if (note) lines.push(note);
  lines.push('请根据当前截图回复下一个动作 JSON。');
  return lines.join('\n');
}

/* ---------- 安全栏：必须仍是仓库根之内的 file:/// 页面 ---------- */
function inRepo(url) {
  if (typeof url !== 'string' || !url.startsWith('file:///')) return false;
  let p;
  try { p = path.resolve(fileURLToPath(url)); } catch (e) { return false; }
  return p === REPO_ROOT || p.startsWith(REPO_ROOT + path.sep);
}

/* 归一化坐标 → 视口像素 */
const px = v => Math.round((Number(v) || 0) / 1000 * VIEW_W);
const py = v => Math.round((Number(v) || 0) / 1000 * VIEW_H);

async function execAction(page, act) {
  switch (act.action) {
    case 'click': {
      const X = px(act.x), Y = py(act.y);
      await page.click(X, Y);
      await sleep(600);
      // 反馈点击落点命中的元素——模型凭此知道点没点对（实测它会误点相邻按钮）。
      // checkbox/radio 报真实勾选态（它们的 value 恒为 "on"，会误导模型）；
      // select 报当前选中值；命中 label 时改报其内部控件的类型与状态。
      const hit = await page.evalJs('(function(){var e=document.elementFromPoint(' + X + ',' + Y + ');' +
        'if(!e)return "null";' +
        'var c=e;if((e.tagName==="LABEL"||e.tagName!=="INPUT")&&e.querySelector){var inner=e.querySelector("input,select,button,textarea");if(inner)c=inner;}' +
        'var s=c.tagName.toLowerCase()+(c.id?"#"+c.id:"");' +
        'if(c.type==="checkbox"||c.type==="radio")return s+" 现在是 "+(c.checked?"checked":"unchecked");' +
        'if(c.tagName==="SELECT")return s+" 当前选中="+c.value;' +
        'var t=(c.innerText||c.value||"").replace(/\\s+/g," ").trim().slice(0,30);' +
        'return s+(t?" \\""+t+"\\"":"")})()').catch(() => null);
      return 'clicked(' + X + ',' + Y + ')' + (hit ? ' 命中: ' + hit : '');
    }
    case 'type':
      await page.click(px(act.x), py(act.y));
      await page.key('a', 2);                    // Ctrl+A 全选
      await page.typeText(String(act.text == null ? '' : act.text));
      await sleep(400);
      return 'typed ' + JSON.stringify(String(act.text || '')).slice(0, 40);
    case 'key':
      await page.key(act.key || 'Enter');
      await sleep(300);
      return 'key ' + (act.key || 'Enter');
    case 'scroll':
      await page.scroll(Number(act.dx) || 0, Number(act.dy) || 0);
      await sleep(400);
      return 'scrolled(' + (Number(act.dx) || 0) + ',' + (Number(act.dy) || 0) + ')';
    case 'drag':
      await page.drag(px(act.x1), py(act.y1), px(act.x2), py(act.y2));
      await sleep(600);
      return 'dragged(' + px(act.x1) + ',' + py(act.y1) + ')->(' + px(act.x2) + ',' + py(act.y2) + ')';
    case 'find': {
      // 把选择器目标 scrollIntoView（含 overflow 侧栏内部滚动），返回它新的归一化中心。
      // 注意：两页有 html{scroll-behavior:smooth}，必须 behavior:'instant' 且滚动后先 sleep 再量 rect，
      // 否则会量到滚动前的位置（实测 find #animFreq 曾返回 y=4461 的越界坐标）。
      const sel = String(act.target || '');
      await page.evalJs('(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');' +
        'if(e)e.scrollIntoView({block:"center",inline:"center",behavior:"instant"});return !!e})()').catch(() => null);
      await sleep(450);
      const info = await page.evalJs('(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');' +
        'if(!e)return null;var r=e.getBoundingClientRect();' +
        'var t=(e.innerText||e.value||"").replace(/\\s+/g," ").trim().slice(0,60);' +
        'if(r.width<2||r.height<2)return JSON.stringify({hidden:true,text:t});' +
        'var x=Math.round((r.left+r.width/2)/innerWidth*1000),y=Math.round((r.top+r.height/2)/innerHeight*1000);' +
        'return JSON.stringify({x:x,y:y,text:t,inView:!(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth)})})()').catch(() => null);
      let o = null;
      try { o = info ? JSON.parse(info) : null; } catch (e) { o = null; }
      if (!o) return 'not found: ' + sel;
      if (o.hidden) return 'found ' + sel + ' 但当前不可见（可能 display:none，需先满足前置条件，如切换预设）' + (o.text ? '；其文本="' + o.text + '"' : '');
      if (!o.inView || o.x < 0 || o.x > 1000 || o.y < 0 || o.y > 1000) return 'found ' + sel + ' 但滚动未就位，请再 find 一次';
      return 'found ' + sel + ' 新中心={"x":' + o.x + ',"y":' + o.y + '}' + (o.text ? ' 文本="' + o.text + '"' : '');
    }
    case 'select': {
      // 原生 <select> 弹层不吃 CDP 合成点击（会穿透到下层控件），程序化设值 + 派发事件
      const sel = String(act.target || ''), want = String(act.value == null ? '' : act.value);
      const js = '(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');' +
        'if(!e||e.tagName!=="SELECT")return "err: not found or not a select";' +
        'var want=' + JSON.stringify(want) + ';' +
        'var o=Array.from(e.options).find(function(o){return o.value===want||o.text.trim()===want});' +
        'if(!o)return "err: no such option " + want;' +
        'e.value=o.value;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));' +
        'return "ok value=" + o.value;})()';
      const r = await page.evalJs(js).catch(e => 'err: ' + e.message);
      await sleep(600);
      return 'select ' + sel + ' → ' + r;
    }
    case 'back':
      await page.evalJs('history.back()').catch(() => {});
      await sleep(900);
      return 'back → ' + await page.url().catch(() => '?');
    default:
      throw new Error('cannot execute action: ' + act.action);
  }
}

/* ---------- 单个功能点 ---------- */
async function runItem(browser, item, opts, budget) {
  const def = PAGES.find(p => p.key === item.page);
  const dir = path.join(OUT_ROOT, item.id);
  fs.mkdirSync(dir, { recursive: true });
  const transcript = [];
  const maxTurns = opts.maxTurns || item.maxTurns || 12;
  const result = { id: item.id, page: item.page, verdict: 'fail', turns: 0, reason: '' };

  const page = await browser.newPage({ width: VIEW_W, height: VIEW_H });
  try {
    await page.goto(fileUrl(def));
    await waitReady(page, def);

    const history = [];
    for (let turn = 1; turn <= maxTurns; turn++) {
      result.turns = turn;
      // 1) 视口截图
      const shotPath = path.join(dir, String(turn).padStart(3, '0') + '.png');
      await page.shot(shotPath);
      // 2) 组装消息
      const controls = await page.evalJs(ENUM_JS).catch(() => []);
      const digest = await page.evalJs(DIGEST_JS).catch(() => null);
      const userText = buildUserText(item, controls, history, digest);
      const imgB64 = fs.readFileSync(shotPath).toString('base64');
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: userText },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,' + imgB64 } },
        ] },
      ];
      // 3) 问模型（解析失败或坐标越界，原样重问一次）
      if (budget.calls >= opts.maxCalls) { result.reason = 'max-calls reached'; break; }
      let act = null, lastErr = '';
      for (let attempt = 0; attempt < 3 && !act; attempt++) {
        budget.calls++;
        let reply;
        try { reply = await qwen.chat({ model: opts.model, messages }); }
        catch (e) { result.reason = 'api-error: ' + e.message; break; }
        const parsed = qwen.parseAction(reply);
        if (parsed.ok) {
          const cerr = coordErr(parsed.action);
          if (!cerr) { act = parsed.action; }
          else {
            lastErr = cerr;
            messages.push({ role: 'user', content: [
              { type: 'text', text: '坐标越界：' + cerr + ' 请重新回复一个合法动作 JSON。' },
            ] });
          }
        }
        else {
          lastErr = parsed.err;
          messages.push({ role: 'user', content: [
            { type: 'text', text: '你的上一次回复无法解析为动作 JSON（' + parsed.err + '）。原回复片段：' +
              reply.slice(0, 200) + '。请只回复一个符合协议的 JSON 动作对象。' },
          ] });
        }
      }
      if (result.reason) break;
      if (!act) { result.reason = 'model-error: 多次回复均无法解析（' + lastErr + '）'; break; }

      // 4) 执行
      if (act.action === 'done') {
        result.verdict = act.verdict === 'pass' ? 'pass' : 'fail';
        result.reason = String(act.reason || '');
        transcript.push({ turn, action: 'done', why: act.why || '', result: result.verdict + ' ' + result.reason });
        console.log('[qa] ' + item.id + ' turn ' + turn + ': done ' + result.verdict + ' ' + result.reason);
        break;
      }
      let execResult = '';
      const urlBefore = await page.url().catch(() => '');
      try { execResult = await execAction(page, act); }
      catch (e) { execResult = 'exec-error: ' + e.message; }
      const urlAfter = await page.url().catch(() => '');
      if (urlAfter && urlBefore && urlAfter !== urlBefore) {
        execResult += '（页面已跳转到 .../' + urlAfter.split('/').pop() + '，原页面坐标作废；可用 back 动作返回）';
      }
      transcript.push({ turn, action: JSON.stringify(act).slice(0, 200), why: act.why || '', result: execResult, state: digest });
      history.push({ turn, action: act.action, why: act.why || '', result: execResult, state: digest });
      console.log('[qa] ' + item.id + ' turn ' + turn + ': ' + execResult);

      // 5) 安全栏：不允许离开仓库内的 file:/// 页面
      const cur = await page.url().catch(() => '');
      if (!inRepo(cur)) {
        result.reason = 'safety: 页面越界到 ' + cur;
        transcript.push({ turn, action: 'safety-check', why: '', result: result.reason });
        break;
      }
    }
    if (!result.reason && result.verdict !== 'pass') result.reason = 'turns-exceeded（' + maxTurns + ' 步内未给出结论）';
    if (result.reason === 'max-calls reached') result.verdict = 'fail';
  } finally {
    fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify({ item: item.id, result, transcript }, null, 2));
    await page.close().catch(() => {});
  }
  return result;
}

/* ---------- dry-run：开页→就绪→首图→打印首轮 prompt，不调 API ---------- */
async function dryRunItem(browser, item) {
  const def = PAGES.find(p => p.key === item.page);
  const dir = path.join(OUT_ROOT, item.id);
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage({ width: VIEW_W, height: VIEW_H });
  try {
    await page.goto(fileUrl(def));
    await waitReady(page, def);
    const shotPath = path.join(dir, 'dryrun.png');
    await page.shot(shotPath);
    const controls = await page.evalJs(ENUM_JS).catch(() => []);
    const digest = await page.evalJs(DIGEST_JS).catch(() => null);
    console.log('\n================ DRY-RUN ' + item.id + ' (page=' + item.page + ') ================');
    console.log('--- system prompt ---');
    console.log(SYSTEM_PROMPT);
    console.log('--- user prompt (turn 1) ---');
    console.log(buildUserText(item, controls, [], digest));
    console.log('--- attachment ---');
    console.log('[image: ' + shotPath + ' ' + VIEW_W + 'x' + VIEW_H + ' viewport png]');
    console.log('================ END ' + item.id + ' ================');
  } finally {
    await page.close().catch(() => {});
  }
}

/* ---------- main ---------- */
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.list) {
    for (const it of CHECKLIST) console.log(it.id + '\t' + it.page + '\t' + it.title);
    console.log('total: ' + CHECKLIST.length + ' items');
    return;
  }
  const items = selectItems(opts.select);
  const browser = await launch({ width: VIEW_W, height: VIEW_H, headed: opts.headed });
  const results = [];
  const budget = { calls: 0 };
  try {
    for (const item of items) {
      if (opts.dryRun) { await dryRunItem(browser, item); continue; }
      if (budget.calls >= opts.maxCalls) {
        results.push({ id: item.id, page: item.page, verdict: 'skipped', turns: 0, reason: 'max-calls reached' });
        continue;
      }
      try { results.push(await runItem(browser, item, opts, budget)); }
      catch (e) { results.push({ id: item.id, page: item.page, verdict: 'fail', turns: 0, reason: 'harness: ' + e.message }); }
    }
  } finally {
    await browser.kill();
  }
  if (opts.dryRun) { console.log('\ndry-run done: ' + items.length + ' item(s), no API calls'); return; }

  console.log('\nitem                 verdict  turns  reason');
  console.log('-------------------  -------  -----  ' + '-'.repeat(50));
  for (const r of results) {
    console.log((r.id + ' '.repeat(20)).slice(0, 20) + '  ' +
      (r.verdict + ' '.repeat(8)).slice(0, 8) + '  ' +
      (String(r.turns) + ' '.repeat(6)).slice(0, 6) + '  ' + r.reason.slice(0, 80));
  }
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.writeFileSync(path.join(OUT_ROOT, 'report.json'), JSON.stringify({ results, apiCalls: budget.calls }, null, 2));
  const fails = results.filter(r => r.verdict !== 'pass').length;
  console.log(fails === 0 ? 'ALL ITEMS PASSED (' + results.length + ')' : 'QA FAILED (' + fails + '/' + results.length + ')');
  if (fails > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
