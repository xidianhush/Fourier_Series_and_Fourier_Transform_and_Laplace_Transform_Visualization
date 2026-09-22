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

/* —— 步骤 B 桩 DOM 配置：IFT 页加载期默认值 —— */
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
/* green2 = 时域面板里的绿色像素（主要是 t=0 那条幅值轴：绿虚线 + 轴旁文字；半像素对齐后是 1px 列，
   实测 98；对齐之前线被摊成两列、计数虚高到 ~184）。探针把 st.t 钉在 0.5，截图才可复现
   （t=0 时白色游标正好压在绿轴上）。
   purple/cyan/grayLab = 频谱谱线（紫）+ 灰包络/轴标签；barPx = 复平面左下角比例尺。 */
const PIXEL = { green2Min: 60, purpleMin: 150, cyanMax: 20, grayLabMin: 40, barPxMin: 20 };

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
  for (const extra of ['assets/expr.js', 'assets/tex.js']) {
    const abs = path.join(ROOT, extra);
    if (fs.existsSync(abs)) {
      const r = spawnSync(NODE, ['--check', abs], { encoding: 'utf8' });
      report(r.status === 0 ? 'ok' : 'FAIL', 'syntax ' + extra, r.status === 0 ? '' : (r.stderr || '').trim());
    } else report('skip', 'syntax ' + extra, '文件不存在');
  }
}

/* ============ 步骤 B0：assets/expr.js 表达式解析器 ============ */
/* [f(t) 文本, t, env, 期望值] 或 [文本, null, null, /正则/] 表示"必须报错" */
const EXPR_CASES = [
  ['2t', 3, null, 6], ['3sin(t)', 3, null, 3 * Math.sin(3)], ['2(t+1)', 3, null, 8],
  ['exp(-a*t)', 1, { a: 1 }, Math.exp(-1)], ['e^{-a*t}', 1, { a: 1 }, Math.exp(-1)],
  ['\\sin(\\pi t)', 0.5, null, 1], ['u(t)', -1, null, 0], ['heaviside(t)', 0, null, 0.5],
  ['-t^2', 3, null, -9], ['2^3^2', 1, null, 512], ['2**3', 1, null, 8], ['2^-1', 1, null, 0.5],
  ['1e-3', 1, null, 0.001], ['a*(1-w0)/2', 1, { a: 1, w0: 2 }, -0.5], ['pow(t,2)', 3, null, 9],
  ['max(t,2t)', 3, null, 6], ['abs(-3t)', 2, null, 6], ['sin(ω0*t)', 1, { w0: 2 }, Math.sin(2)],
  ['u(t-2)*exp(-t)', 3, null, Math.exp(-3)], ['exp(-2t)u(t)', 1, null, Math.exp(-2)],
  ['2（t+1）', 3, null, 8], ['t^2/(1+t)', 2, null, 4 / 3],
  ['', null, null, /empty expression/], ['t+', null, null, /missing operand/], ['(t+1', null, null, /unclosed parenthesis/],
  ['t+1)', null, null, /unexpected/], ['sin', null, null, /unknown symbol/], ['2 $ t', null, null, /unexpected/],
  ['exp(t, 2)', null, null, /expects 1 argument/], ['foo(t)', null, null, /unknown function/],
  ['exp(-t^2/(2*s))', null, null, /unknown symbol s/]
];
function stepExpr() {
  const abs = path.join(ROOT, 'assets/expr.js');
  if (!fs.existsSync(abs)) { report('skip', 'expr parse', 'assets/expr.js 不存在'); return; }
  const stub = makeStub();
  let parseExpr;
  try {
    const f = new Function('window', 'globalThis', fs.readFileSync(abs, 'utf8') + '\n;return window.parseExpr;');
    parseExpr = f(stub.win, stub.win);
  } catch (e) { report('FAIL', 'expr parse', '加载抛错: ' + e.message); return; }
  if (typeof parseExpr !== 'function') { report('FAIL', 'expr parse', '未导出 parseExpr'); return; }
  const bad = [];
  for (const [src2, t, env, want] of EXPR_CASES) {
    const r = parseExpr(src2);
    if (want instanceof RegExp) {
      if (r.ok) bad.push('「' + src2 + '」应当报错却通过了');
      else if (!want.test(r.err)) bad.push('「' + src2 + '」报错文案不符: ' + r.err);
    } else {
      if (!r.ok) { bad.push('「' + src2 + '」解析失败: ' + r.err); continue; }
      const got = r.at(t, env || { a: 1, w0: 2 });
      if (!(Math.abs(got - want) <= 1e-12)) bad.push('「' + src2 + '」@t=' + t + ' = ' + got + '，期望 ' + want);
    }
  }
  /* used 记录、变量别名、超长拒绝 */
  const r1 = parseExpr('exp(-a*t)*sin(w0*t)');
  if (!(r1.ok && r1.used.t && r1.used.a && r1.used.w0)) bad.push('used 未记录 t/a/w0');
  const r2 = parseExpr('sin(ω0*t)');
  if (!(r2.ok && r2.used.w0)) bad.push('ω0 未归一到 w0');
  if (parseExpr('t' + '+t'.repeat(200)).ok) bad.push('超长表达式未被拒');
  report(bad.length === 0 ? 'ok' : 'FAIL', 'expr parse',
    bad.length ? bad.join('; ') : EXPR_CASES.length + ' 条语法/求值用例 + used/别名/超长 全部符合');
}

/* ============ 步骤 B0b：assets/tex.js TeX 子集渲染器 ============ */
/* [TeX, 渲染结果里必须出现的片段]；带 /ERR/ 的表示"必须报错回退成 .texerr" */
const TEX_CASES = [
  ['\\frac{1}{2\\pi j}', ['class="mfrac"', 'class="mnum">1<', 'class="mden">2']],
  ['X(s)', ['<i>X</i>']],
  ['e^{st}', ['<sup>']],
  ['\\Delta\\omega_{k}', ['<sub>']],
  ['\\int_{\\sigma-j\\infty}^{\\sigma+j\\infty}', ['data-big="int"', '<sub>', '<sup>']],
  ['\\sum_{n=-N}^{N}', ['class="mstack"', 'class="mup"', 'class="mdn"']],
  ['\\lim_{\\Delta\\omega\\to 0}', ['class="mstack"', 'data-big="lim"', '<span class="mfn"']],
  ['\\sqrt{1+\\omega^{2}}', ['class="msqrt"', 'class="mbody"']],
  ['\\text{ROC}', ['class="mtext">ROC<']],
  ['\\sigma\\omega\\Delta\\pi', ['σ', 'ω', 'Δ', 'π']],
  ['a=b+c', ['class="mrel">=<', 'class="mbin">+<']],
  ['\\sin(\\omega t)', ['class="mfn">sin<']],
  ['\\left(\\frac{a}{b}\\right)', ['class="mfrac"', '(']],
  ['\\{x\\}', ['{<i>x</i>}']],
  ['e^{-\\sigma t}', ['−']],
  ['', []]
];
const TEX_BAD = ['\\foo{x}', '\\frac{1}{2', '}x', 'e^{', '\\sqrt'];
function stepTex() {
  const abs = path.join(ROOT, 'assets/tex.js');
  if (!fs.existsSync(abs)) { report('skip', 'tex render', 'assets/tex.js 不存在'); return; }
  const stub = makeStub();
  let renderTex;
  try {
    const f = new Function('window', 'globalThis', fs.readFileSync(abs, 'utf8') + '\n;return window.renderTex;');
    renderTex = f(stub.win, stub.win);
  } catch (e) { report('FAIL', 'tex render', '加载抛错: ' + e.message); return; }
  if (typeof renderTex !== 'function') { report('FAIL', 'tex render', '未导出 renderTex'); return; }
  const bad = [];
  for (const [src2, want] of TEX_CASES) {
    const out = renderTex(src2);
    for (const nd of want) if (out.indexOf(nd) < 0) { bad.push('「' + src2 + '」缺 ' + nd); break; }
    if (/texerr/.test(out)) bad.push('「' + src2 + '」意外报错');
  }
  for (const src2 of TEX_BAD) {
    if (!/texerr/.test(renderTex(src2))) bad.push('「' + src2 + '」本该报错回退');
  }
  /* .tex-block 的 texify() 会自动补 .tex 类（CSS 只写一套 .tex 规则） */
  report(bad.length === 0 ? 'ok' : 'FAIL', 'tex render',
    bad.length ? bad.join('; ') : (TEX_CASES.length + ' 条渲染用例 + ' + TEX_BAD.length + ' 条报错回退 全部符合'));
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
      commonSrc + '\n;\nvar colFor=window.colFor, fmt=window.fmt, fmtG=window.fmtG, bucketOf=window.bucketOf, clamp=window.clamp, attachPointer=window.attachPointer;\n' + iftSrc + '\n;\nreturn window.__IFT;'
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
  const C = H.comp();
  if (!C || C.N !== IFT_EXPECT.N) bad.push('N=' + (C && C.N));
  const e0 = H.chainAt(0).end;
  if (!near(e0[0], IFT_EXPECT.chain0Re, 1e-9)) bad.push('chainAt(0).end[0]=' + e0[0]);
  const CV = H.curve();
  if (CV && CV.re && CV.ts) {
    let maxd = 0;
    for (let i = 0; i < CV.re.length; i++) maxd = Math.max(maxd, Math.abs(CV.re[i] - H.sExact(CV.ts[i])[0]));
    if (!(maxd < IFT_EXPECT.curveMaxDev)) bad.push('max|curve.re-sExact|=' + maxd);
  } else bad.push('curve 字段形状不符（re/ts）');
  for (let n = -C.N; n <= C.N; n++) {
    if (H.phaseFrac(n) !== 0.5) { bad.push('dexp phaseFrac(' + n + ')=' + H.phaseFrac(n)); break; }
  }
  const reg = H.regime();
  if (!reg || reg.k !== IFT_EXPECT.regimeK) bad.push('regime.k=' + (reg && reg.k));
  /* 切到 sexp 预设：走 apply（内部重算；桩里 frame 不跑、dirty 不消费，勿用 change 事件） */
  H.apply({ preset: 'sexp', p: H.PRESETS.sexp.pdef });
  const N2 = H.comp().N;
  const pm = H.phaseFrac(-N2), pp = H.phaseFrac(N2), p0 = H.phaseFrac(0);
  if (!near(pm, IFT_EXPECT.sexpPhaseAtNegN, 1e-3)) bad.push('sexp phaseFrac(-N)=' + pm);
  if (!near(pp, IFT_EXPECT.sexpPhaseAtPosN, 1e-3)) bad.push('sexp phaseFrac(N)=' + pp);
  if (!near(p0, 0.5, 1e-9)) bad.push('sexp phaseFrac(0)=' + p0);
  /* —— 复平面量程冻结（勾选后）：sc 与 t 无关、端箭头长 ∝ |s(t)|；不勾时退回每帧自适应 —— */
  if (!H.mxRef || !H.drawSc || !H.chainExtent) bad.push('未导出 mxRef()/drawSc()/chainExtent()');
  else {
    if (H.st.freezeScale !== true) bad.push('ift 默认应勾上量程冻结（与拉普拉斯页一致），实为 ' + H.st.freezeScale);
    H.apply({ preset: 'dexp', p: 1, dw: 0.05, omxUnits: 8, freezeScale: true });
    const e0 = H.chainExtent(0), e5 = H.chainExtent(5);
    if (!(e0 > 1.5 * e5 || e5 > 1.5 * e0)) bad.push('取的 t 上链幅度太接近，判据没意义');
    if (!(H.mxRef() > 0)) bad.push('冻结量程 mxRef 应 > 0');
    /* 冻结量程必须 ≥ 窗内最大幅度，否则 t≈0 时链冲出面板（computeScale 采样点若跳过 t=0 就会踩这个） */
    let wmax = 0, wi;
    for (wi = 0; wi <= 40; wi++) { const tt = -H.PRESETS.dexp.tail(1) + 2 * H.PRESETS.dexp.tail(1) * wi / 40; wmax = Math.max(wmax, H.chainExtent(tt)); }
    if (!(H.mxRef() >= wmax - 1e-9)) bad.push('冻结量程 ' + H.mxRef().toExponential(3) + ' < 窗内最大幅度 ' + wmax.toExponential(3) + '（采样点漏了 t=0？）');
    H.st.t = 0; H.draw(); const sc0 = H.drawSc(), s0 = Math.hypot(...H.sExact(0));
    H.st.t = 5; H.draw(); const sc5 = H.drawSc(), s5 = Math.hypot(...H.sExact(5));
    if (Math.abs(sc0 - sc5) > 1e-12) bad.push('量程未冻结：sc 随 t 变 ' + sc0 + '→' + sc5);
    if (Math.abs((s0 * sc0) / (s5 * sc5) / (s0 / s5) - 1) > 1e-9) bad.push('端箭头长 ∝ |s(t)| 不成立');
    /* 默认（不勾）是每帧自适应：mxRef()=0，sc 随链幅度变 */
    H.apply({ freezeScale: false });
    H.st.t = 0; H.draw(); const a0 = H.drawSc();
    H.st.t = 5; H.draw(); const a5 = H.drawSc();
    if (H.mxRef() !== 0) bad.push('未勾冻结时 mxRef 应为 0（自适应）');
    if (!(a0 / a5 > 1.5 || a5 / a0 > 1.5)) bad.push('自适应下 sc 不随链幅度变: ' + a0 + ' vs ' + a5);
    /* 端点 ≈0 的画法：够长 → 实长箭头；中档 → 虚线示意箭头；全静音 → 不给方向 */
    if (!H.arrowInfo) bad.push('未导出 arrowInfo()');
    else {
      H.apply({ preset: 'dexp', p: 1, dw: 0.05, omxUnits: 8, freezeScale: false });
      H.st.t = 0; H.draw();
      /* 链段配色与频谱/栅栏同源（都按相位桶），否则"悬停同色段"对不上 */
      if (!H.chainBuckets) bad.push('未导出 chainBuckets()');
      else {
        const cb = H.chainBuckets(), N = H.comp().N;
        if (!cb) bad.push('chainBuckets() 为空');
        else for (const n of [0, 3, -3, N, -N]) if (cb[n + N] !== H.phaseBucket(n)) { bad.push('链段 [' + n + '] 配色 ≠ 相位桶'); break; }
      }
      const ai0 = H.arrowInfo();
      if (!ai0 || ai0.px <= 3 || ai0.stub) bad.push('t=0 端点应画实长箭头: ' + JSON.stringify(ai0));
      H.st.mask.fill(0); H.st.t = 0; H.draw();
      const ai1 = H.arrowInfo();
      if (!(ai1 && ai1.px <= 1e-3 && ai1.stub === false)) bad.push('全静音时端点应 ≈0 且不给方向: ' + JSON.stringify(ai1));
      H.st.mask.fill(1); H.computeComp();
      /* 中间档：找 |s(t)|·sc ∈ (1e-3, 3] 的 t */
      H.st.t = 0; H.draw();
      const scA = H.drawSc(), TwA = H.twNow ? H.twNow() : H.PRESETS[H.st.preset].tail(H.st.p);
      let tMid = null;
      for (let tt = -TwA; tt <= TwA + 1e-9; tt += TwA / 200) {
        const ss = Math.hypot(...H.sExact(tt));
        if (ss * scA > 1e-3 && ss * scA <= 3) { tMid = tt; break; }
      }
      if (tMid === null) bad.push('找不到"端点很小"的 t，示意箭头这条判据没跑起来');
      else { H.st.t = tMid; H.draw(); const ai2 = H.arrowInfo(); if (!ai2.stub) bad.push('t=' + tMid.toFixed(2) + ' 端点 ' + ai2.px.toFixed(3) + 'px 应画示意箭头'); }
    }
    H.apply({ preset: 'dexp', p: 1, dw: 0.05, omxUnits: 8, freezeScale: false });
    H.computeComp();
  }
  if (bad.length === 0) report('ok', 'stub-math ift', 'N/chain0/curve/phaseFrac/regime/量程冻结/≈0 端点 全部符合');
  else report('FAIL', 'stub-math ift', bad.join('; '));
}

/* —— 拉普拉斯页（3D s 平面）的期望值：默认 preset=sexp、p=1、σ=0.5、Δω=0.05 —— */
const LIT_EXPECT = {
  N: 480,
  phaseAtNegN: 0.7400657378472295,
  phaseAtPosN: 0.25993426215277043,
  stageK: 2,
};

/* —— 步骤 D2 像素判据（默认状态下实测值：sat≈13850、satUpper≈3160、gband≈22820、winLift≈266） —— */
const LIT_PIXEL = { satMin: 4000, satUpperMin: 800, gbandMin: 5000, winLiftMin: 80, barPxMin: 20 };

/* ============ 步骤 B2：桩 DOM + 3D 投影断言（laplace） ============ */
function stepStubMathLaplace() {
  const p = PAGES.find(x => x.key === 'laplace');
  if (!selected.includes(p)) return;
  const jsAbs = path.join(ROOT, p.js);
  if (!fs.existsSync(jsAbs)) { report('skip', 'stub-math laplace', 'assets/laplace.js 不存在（尚未迁移）'); return; }
  const commonSrc = fs.readFileSync(path.join(ROOT, 'assets/common.js'), 'utf8');
  const exprAbs = path.join(ROOT, 'assets/expr.js');
  const exprSrc = fs.existsSync(exprAbs) ? fs.readFileSync(exprAbs, 'utf8') : '';
  const src = fs.readFileSync(jsAbs, 'utf8');
  const stub = makeStub();
  let H;
  try {
    const factory = new Function(
      'window', 'self', 'globalThis', 'document', 'performance',
      'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia', 'setTimeout', 'clearTimeout',
      commonSrc + '\n' + exprSrc + '\n;var colFor=window.colFor, fmt=window.fmt, fmtG=window.fmtG, bucketOf=window.bucketOf, clamp=window.clamp, attachPointer=window.attachPointer, parseExpr=window.parseExpr;\n' + src + '\n;\nreturn window.__LIT;'
    );
    H = factory(stub.win, stub.win, stub.win, stub.win.document, stub.win.performance,
      stub.win.requestAnimationFrame, stub.win.cancelAnimationFrame, stub.win.matchMedia,
      stub.win.setTimeout, stub.win.clearTimeout);
  } catch (e) {
    report('FAIL', 'stub-math laplace', '加载抛错: ' + e.message);
    return;
  }
  if (!H) { report('FAIL', 'stub-math laplace', '未导出 window.__LIT'); return; }
  const bad = [];
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const C = H.comp();
  if (!C || C.N !== LIT_EXPECT.N) bad.push('N=' + (C && C.N));
  const pr = H.PRESETS[H.st.preset] || H.PRESETS.sexp;
  const k = H.st.dw / (2 * Math.PI);
  for (const n of [0, 1, 100, -100, C.N, -C.N]) {
    const X = pr.X2(H.st.sig, n * H.st.dw, H.st.p);
    if (Math.abs(C.re[n + C.N] - X[0] * k) > 1e-12 || Math.abs(C.im[n + C.N] - X[1] * k) > 1e-12)
      bad.push('权重[' + n + '] ≠ X(σ+jnΔω)·Δω/2π');
  }
  /* 实信号共轭对称 ⇒ 相位分色在 ω 上奇对称（3D 栅栏两侧配色镜像） */
  const pm = H.phaseFrac(-C.N), pp = H.phaseFrac(C.N);
  if (!near(pm + pp, 1, 1e-9)) bad.push('phaseFrac(-N)+phaseFrac(N)=' + (pm + pp));
  if (!near(pm, LIT_EXPECT.phaseAtNegN, 1e-6)) bad.push('phaseFrac(-N)=' + pm);
  if (!near(pp, LIT_EXPECT.phaseAtPosN, 1e-6)) bad.push('phaseFrac(N)=' + pp);
  if (H.regime().k !== LIT_EXPECT.stageK) bad.push('regime.k=' + H.regime().k);
  const e0 = H.chainAt(0).end;
  if (!near(e0[0], 0.5, 0.03) || Math.abs(e0[1]) > 1e-9) bad.push('chainAt(0).end=[' + e0 + ']');
  /* 3D 视图几何：地板/高度轴不出面板、栅栏柱竖直向上生长、换视角投影随之改变 */
  H.draw();
  const R = H.rects ? H.rects() : null, V = H.view3 ? H.view3() : null;
  if (!R || !V) bad.push('未导出 rects()/view3()');
  else {
    const spec = R.spec;
    const inside = q => q && q[0] >= spec.x - 1 && q[0] <= spec.x + spec.w + 1 && q[1] >= spec.y - 1 && q[1] <= spec.y + spec.h + 1;
    const srr = pr.srange(H.st.p), imr = pr.imr(H.st.p);
    for (const c of [[-imr, srr[0]], [-imr, srr[1]], [imr, srr[1]], [imr, srr[0]]])
      if (!inside(H.proj3(c[0], c[1], 0))) bad.push('地板角(' + c + ')出面板');
    if (!inside(H.proj3(-imr, srr[0], V.ymax))) bad.push('高度轴顶端出面板');
    const b0 = H.proj3(0, H.st.sig, 0), t0 = H.proj3(0, H.st.sig, V.ymax);
    if (!(t0[1] < b0[1] - 20)) bad.push('栅栏柱未向上生长 dy=' + (b0[1] - t0[1]));
    if (Math.abs(t0[0] - b0[0]) > 1e-9) bad.push('栅栏柱不竖直 dx=' + (t0[0] - b0[0]));
    /* 栅栏远端（ω=imr）在换 yaw 后必须明显移动（近中心的点几乎不动，不能用来判旋转） */
    const fenceEnd0 = H.proj3(imr, H.st.sig, 0);
    H.apply({ yaw: -0.6, pitch: 0.5 });
    H.draw();
    const fenceEnd1 = H.proj3(imr, H.st.sig, 0);
    if (Math.abs(fenceEnd1[0] - fenceEnd0[0]) < 20) bad.push('换 yaw 后投影未变 dx=' + (fenceEnd1[0] - fenceEnd0[0]));
    H.apply({ yaw: 0.55, pitch: 0.34 });
    H.draw();
  }
  /* —— 复平面量程冻结：sc 与 t 无关（否则 Re s(t) 差几十倍却画得一样长），端箭头长 ∝ |s(t)| —— */
  if (H.st.freezeScale !== true) bad.push('laplace 默认应勾上量程冻结，实为 ' + H.st.freezeScale);
  H.apply({ preset: 'sexp', p: 1, sig: 0.5, dw: 0.05, omxUnits: 8, winMul: 1, freezeScale: true });
  if (!H.mxRef || !H.chainExtent) bad.push('未导出 mxRef()/chainExtent()');
  else {
    const scOf = () => H.drawSc();            /* 直接读"上一次 draw() 真正用的缩放"，不然测不到画法 */
    const e0 = H.chainExtent(0), e3 = H.chainExtent(3);
    if (!(e0 > 2 * e3 || e3 > 2 * e0)) bad.push('取的两个 t 上链幅度太接近，判据没意义 e0=' + e0 + ' e3=' + e3);
    if (!(H.mxRef() > 0)) bad.push('冻结量程 mxRef 应 > 0，得 ' + H.mxRef());
    H.st.t = 0; H.draw(); const sc0 = scOf(), s0 = Math.hypot(...H.sExact(0));
    H.st.t = 3; H.draw(); const sc3 = scOf(), s3 = Math.hypot(...H.sExact(3));
    if (Math.abs(sc0 - sc3) > 1e-12) bad.push('量程未冻结：sc 随 t 变 ' + sc0 + '→' + sc3);
    /* 端点箭头长 = |s(t)|·sc：跨 t 的比值必须等于 |s(t)| 的比值（这就是用户要的"能比大小"） */
    const ratioPx = (s0 * sc0) / (s3 * sc3), ratioS = s0 / s3;
    if (Math.abs(ratioPx / ratioS - 1) > 1e-9) bad.push('端箭头长 ∝ |s(t)| 不成立: ' + ratioPx + ' vs ' + ratioS);
    if (!(H.mxRef() >= Math.max(e0, e3))) bad.push('量程小于窗内链幅度，链会画出界');
    /* 取消冻结 → 退回每帧自适应（sc 随链幅度变） */
    H.apply({ freezeScale: false });
    H.st.t = 0; H.draw(); const a0 = scOf();
    H.st.t = 3; H.draw(); const a3 = scOf();
    if (H.mxRef() !== 0) bad.push('取消冻结后 mxRef 应为 0（自适应），得 ' + H.mxRef());
    if (!(a0 / a3 > 1.5 || a3 / a0 > 1.5)) bad.push('取消冻结后 sc 仍不随链幅度变: ' + a0 + ' vs ' + a3);
    H.apply({ freezeScale: true });
  }
  /* —— 端点 ≈0 时的画法：中档画虚线"示意箭头"+≈0 标注，过小就不给方向 —— */
  if (!H.arrowInfo) bad.push('未导出 arrowInfo()');
  else {
    H.apply({ preset: 'sexp', p: 1, sig: 0.5, dw: 0.05, omxUnits: 8, winMul: 1, freezeScale: true });
    H.st.t = 0; H.draw();
    const scA = H.drawSc(), TwA = H.twNow();
    /* 链段配色必须与 3D 栅栏同源（都按相位），否则"悬停某根柱子 → 链上同色段"就对不上 */
    if (!H.chainBuckets || !H.phaseBucket) bad.push('未导出 chainBuckets()/phaseBucket()');
    else {
      const cb = H.chainBuckets(), N = H.comp().N;
      if (!cb) bad.push('chainBuckets() 为空');
      else {
        for (const n of [0, 1, 7, -7, N, -N, Math.floor(N / 3)]) {
          if (cb[n + N] !== H.phaseBucket(n)) { bad.push('链段 [' + n + '] 配色 ' + cb[n + N] + ' ≠ 相位桶 ' + H.phaseBucket(n)); break; }
        }
      }
    }
    const findT = (lo, hi) => {
      for (let tt = -TwA; tt <= TwA + 1e-9; tt += TwA / 200) {
        const s = Math.hypot(...H.sExact(tt));
        if (s * scA > lo && s * scA <= hi) return tt;
      }
      return null;
    };
    for (const [lo, hi, want, tag] of [[3, 1e9, false, '够长'], [1e-3, 3, true, '中档(示意箭头)']]) {
      const tt = findT(lo, hi);
      if (tt === null) { bad.push('找不到「' + tag + '」档的 t，这条判据没跑起来'); continue; }
      H.st.t = tt; H.draw();
      const ai = H.arrowInfo();
      if (ai.stub !== want) bad.push(tag + ' 档 t=' + tt.toFixed(2) + ' stub=' + ai.stub + '（期望 ' + want + '），端点 px=' + ai.px.toFixed(3));
    }
    /* 全部静音 ⇒ s(t) ≡ 0 ⇒ 端点 0px、不给方向 */
    H.st.mask.fill(0); H.st.t = 0; H.draw();
    const ai0 = H.arrowInfo();
    if (!(ai0 && ai0.px <= 1e-3 && ai0.stub === false)) bad.push('全静音时端点应 ≈0 且不给方向: ' + JSON.stringify(ai0));
    H.st.mask.fill(1); H.computeComp(); H.draw();
    H.apply({ freezeScale: true });
  }
  /* —— 观测窗倍数 k：Tw 与轴宽 Xw=clamp(Tr+Tw,3Tw,6Tw) 都要跟着走 —— */
  H.apply({ winMul: 0.5 });
  const tw5 = 0.5 * H.PRESETS[H.st.preset].tail(H.st.p);
  if (Math.abs(H.twNow() - tw5) > 1e-9) bad.push('winMul 未作用于 Tw: ' + H.twNow());
  const xw5 = Math.min(Math.max(H.trNow() + tw5, 3 * tw5), 6 * tw5);
  if (Math.abs(H.xwNow() - xw5) > 1e-9) bad.push('winMul 未作用于 Xw: ' + H.xwNow());
  H.apply({ winMul: 1 });
  /* —— 自定义信号（B 路线）：数值 X 对拍闭式解 + 估计量 + 非法表达式回退 —— */
  if (!H.cus || !H.cusQuad) bad.push('未导出 cus()/cusQuad()');
  else {
    const closed = {
      'exp(-t)*u(t)': function (w) { const d = 1.5 * 1.5 + w * w; return [1.5 / d, -w / d]; },
      'exp(-1*abs(t))': function (w) { const re = 0.75 + w * w, im = w, d = re * re + im * im; return [2 * re / d, 2 * im / d]; }
    };
    for (const cs in closed) {
      H.apply({ preset: 'custom', fstr: cs, p: 1, w0: 2, sig: 0.5 });
      H.computeComp();
      if (H.cus().err) { bad.push('custom 解析「' + cs + '」报错: ' + H.cus().err); continue; }
      let worst = 0, wat = 0;
      for (let w = 0; w <= 20; w += 2) {
        const g = H.cusQuad(0.5, w), a = closed[cs](w);
        const rel = Math.hypot(g[0] - a[0], g[1] - a[1]) / Math.max(1e-12, Math.hypot(a[0], a[1]));
        if (rel > worst) { worst = rel; wat = w; }
      }
      if (!(worst < 0.015)) bad.push('数值 X 与闭式解差 ' + (100 * worst).toFixed(2) + '% @ω=' + wat + '（' + cs + '）');
    }
    /* 权重 = X(σ+jnΔω)·Δω/2π（数值 X 也要满足） */
    H.apply({ preset: 'custom', fstr: 'exp(-t)*u(t)', p: 1, sig: 0.5, dw: 0.05 });
    H.computeComp();
    /* 数值 X 有约 1e-3 量级的求积误差，这里按相对误差 1e-4 卡（够抓符号/系数错） */
    const C3 = H.comp(), k3 = H.st.dw / (2 * Math.PI), w3 = 3 * H.st.dw, d3 = 1.5 * 1.5 + w3 * w3;
    if (Math.abs(C3.re[3 + C3.N] / ((1.5 / d3) * k3) - 1) > 1e-4) bad.push('custom 权重 ≠ X·Δω/2π（实部）');
    if (Math.abs(C3.im[3 + C3.N] / (-(w3 / d3) * k3) - 1) > 1e-4) bad.push('custom 权重 ≠ X·Δω/2π（虚部，注意 e^{-jωt} 的符号）');
    /* 估计量：e^{-t}u(t) 应与 sexp 预设同口径（Tw=6、ROC 下界 −1） */
    if (Math.abs(H.cus().tail - 6) > 0.05) bad.push('custom 观测窗估计 Tw=' + H.cus().tail + '（期望 6）');
    if (Math.abs(H.cus().rocLo + 1) > 0.1) bad.push('custom ROC 下界估计=' + H.cus().rocLo + '（期望 −1）');
    /* 超指数衰减（高斯型）不约束 σ：两侧都是 ∓∞，与 gauss 预设同口径 */
    H.apply({ fstr: 'exp(-t^2/2)' });
    H.computeComp();
    if (H.cus().rocLo !== -Infinity || H.cus().rocHi !== Infinity)
      bad.push('高斯型 ROC 应为 (−∞,+∞)，得 (' + H.cus().rocLo + ',' + H.cus().rocHi + ')');
    /* 非法表达式：报英文错、保留上一个可用信号 */
    H.apply({ fstr: 'exp(-t)*u(t)' });
    H.computeComp();
    H.apply({ fstr: 'exp(-t)*' });
    H.computeComp();
    if (!H.cus().err) bad.push('非法表达式未报错');
    if (Math.abs(H.xOf(1) - Math.exp(-1)) > 1e-12) bad.push('非法表达式后丢了上一个可用信号');
    H.apply({ preset: 'sexp', p: 1, sig: 0.5, dw: 0.05, omxUnits: 8, winMul: 1 });
    H.computeComp();
  }
  if (bad.length === 0) report('ok', 'stub-math laplace', 'N/权重/相位对称/regime/3D 投影/winMul/自定义信号数值 X 全部符合');
  else report('FAIL', 'stub-math laplace', bad.join('; '));
}

/* ============ 步骤 C：无头探针 ============ */
/* 钉住画布尺寸：--dump-dom 与 --screenshot 两次运行的视口宽高并不相同（1600x900 vs 1578x802），
   不钉住的话截图里的画布会被拉伸（1242→1264 宽），像素扫描的坐标就对不上了。 */
const PROBE_SNIPPET = `
<style>.stage{flex:none;width:1242px;height:730px}</style>
<script>
/* 挂在 load 上：DOMContentLoaded 之后 assets/tex.js 才会把公式排版掉，立即跑会量到未排版的布局 */
window.addEventListener('load', function(){
  var info='PROBE';
  try{
    var cv=document.getElementById('cv');
    var r=cv?cv.getBoundingClientRect():null;
    info+=' cv='+(r?Math.round(r.width)+'x'+Math.round(r.height)+'@'+Math.round(r.left)+','+Math.round(r.top):'none');
    var eb=document.getElementById('errbar');
    info+=' err='+(eb&&eb.classList&&eb.classList.contains('on')?'1':'0');
    var h=window.__VIZ;
    info+=' viz='+(h?'1':'0');
    if(h&&h.st&&h.draw){ h.st.playing=false; h.st.t=0.5; h.draw(); info+=' draw=ok'; }   /* t 固定：截图/像素扫描才可复现（t=0 时白色游标正好压在 t=0 绿轴上） */
    /* TeX 公式（assets/tex.js）：全渲染完、无报错、分式确实上下叠放 */
    var txAll=document.querySelectorAll('.tex,.tex-block');
    var txUndone=document.querySelectorAll('.tex:not([data-tex-done]),.tex-block:not([data-tex-done])').length;
    var txErr=document.querySelectorAll('.texerr').length;
    var fr=document.querySelectorAll('.tex .mfrac'), fracBad=0, fi;
    for(fi=0;fi<fr.length;fi++){
      var nm=fr[fi].querySelector('.mnum'), dn=fr[fi].querySelector('.mden');
      if(!nm||!dn){ fracBad++; continue; }
      var nb=nm.getBoundingClientRect(), db=dn.getBoundingClientRect();
      if(!(nb.bottom<=db.top+1.5)) fracBad++;
      if(Math.abs((nb.left+nb.right)/2-(db.left+db.right)/2)>3) fracBad++;
    }
    info+=' tex='+txAll.length+'/undone='+txUndone+'/texErr='+txErr+'/fracBad='+fracBad;
  }catch(e){ info+=' throw='+e.message; }
  document.title=info;
});
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
    const texM = title.match(/tex=(\d+)\/undone=(\d+)\/texErr=(\d+)\/fracBad=(\d+)/);
    if (texM) {
      if (+texM[2] > 0) return { status: 'FAIL', detail: 'TeX 公式没渲染完 undone=' + texM[2] + ' ' + title, rect: rect, viz: true };
      if (+texM[3] > 0) return { status: 'FAIL', detail: 'TeX 公式有报错 texErr=' + texM[3] + ' ' + title, rect: rect, viz: true };
      if (+texM[4] > 0) return { status: 'FAIL', detail: '分式没有上下叠放 fracBad=' + texM[4] + ' ' + title, rect: rect, viz: true };
    }
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
  let green2 = 0, purple = 0, cyan = 0, grayLab = 0, barPx = 0;
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
  /* 复平面左下角的比例尺（#8fa2c4 横线 + 两端刻度 + 文字）——量程自适应的页也靠它读绝对值 */
  const bx0 = L + 34, bx1 = Math.min(L + 34 + 150, png.w - 1);
  const by0 = T + 26 + (topH - 40) - 24, by1 = Math.min(by0 + 16, png.h - 1);
  for (let y = Math.max(0, by0); y <= by1; y++) {
    for (let x = Math.max(0, bx0); x <= bx1; x++) {
      const o = at(x, y), r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (Math.abs(r - 143) < 40 && Math.abs(g - 162) < 40 && Math.abs(b - 196) < 40) barPx++;
    }
  }
  return { green2: green2, purple: purple, cyan: cyan, grayLab: grayLab, barPx: barPx };
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
    if (s.barPx <= PIXEL.barPxMin) bad.push('barPx=' + s.barPx);
    const detail = 'green2=' + s.green2 + ' purple=' + s.purple + ' cyan=' + s.cyan + ' grayLab=' + s.grayLab + ' barPx=' + s.barPx;
    report(bad.length === 0 ? 'ok' : 'FAIL', 'pixels ift', detail + (bad.length ? '  不符: ' + bad.join(',') : ''));
  } catch (e) {
    report('FAIL', 'pixels ift', e.message);
  } finally {
    try { fs.unlinkSync(tmpHtml); } catch (e) { /* ignore */ }
    try { fs.unlinkSync(tmpPng); } catch (e) { /* ignore */ }
  }
}

/* ============ 步骤 D2：像素扫描（laplace 的 3D s 平面面板） ============ */
/* sat        = 饱和色像素（相位分色的栅栏柱、青色积分路径、粉色极点标记）总数
   satUpper   = 其中落在面板上半部者：地板平面之上还站着东西 ⇒ 确实是三维栅栏
   gband      = 地板上的 ROC 绿（带宽填充 + 虚线边界），弱绿也算
   winLift    = 时域面板观测窗 |t|≤Tw 内、离轴 ≥20px 的亮青像素：链端点读数与图上高度对不对得上。
                默认状态（sexp、Δω=0.05）Tw=6 s、轴 ±Xw=±36 s，窗占时域面板中央 1/3。
                纵轴若改回"全轴取最大"，σ>0 时窗外被 e^{σt} 放大的截断误差会占满量程、
                把窗内曲线压到轴上，此计数掉回 0（该量本身是 2026-09 修掉的那个 bug 的指纹）。
   barPx      = 复平面左下角比例尺（#8fa2c4 横线 + 两端刻度 + 数值文字）的像素：量程冻结后
                "能读绝对值"就靠它，删掉/挪走比例尺这条会掉下来。 */
function scanPixelsLaplace(png, rect) {
  const T = Math.round(rect.top), L = Math.round(rect.left);
  const CW = Math.round(rect.width), CH = Math.round(rect.height);
  const topH = Math.round(CH * 0.55);
  const sw = Math.round((CW - 42) * 0.55);
  const x0 = L + 14 + sw + 14, y0 = T + 26, w = CW - 28 - sw - 14, h = topH - 40;
  let sat = 0, satUpper = 0, gband = 0, winLift = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const o = (y * png.w + x) * png.ch, r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 80) { sat++; if (y < y0 + h * 0.55) satUpper++; }
      if (g > r + 8) gband++;
    }
  }
  /* 时域面板（R.time = {14, topH+18, CW-28, CH-topH-30}）：窗内 x 由 X(t)=x+w(t+Xw)/(2Xw) 定 */
  const tX = t => L + 14 + (CW - 28) * (t + 36) / 72;
  const ty0 = T + topH + 18, ty1 = ty0 + (CH - topH - 30), tyAx = (ty0 + ty1) / 2;
  for (let y = ty0 + 2; y < ty1 - 2; y++) {
    if (Math.abs(y - tyAx) <= 20) continue;
    for (let x = Math.round(tX(-6)); x < Math.round(tX(6)); x++) {
      const o = (y * png.w + x) * png.ch, r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (b > 200 && r > 90 && r < 210 && g > 150 && g < 235) winLift++;
    }
  }
  /* 复平面左下角的比例尺（横线 + 两端刻度 + "|s| = …（比例尺）"文字） */
  const bx0 = L + 34, bx1 = Math.min(L + 34 + 150, png.w - 1);
  const by0 = T + 26 + (topH - 40) - 24, by1 = Math.min(by0 + 16, png.h - 1);
  let barPx = 0;
  for (let y = Math.max(0, by0); y <= by1; y++) {
    for (let x = Math.max(0, bx0); x <= bx1; x++) {
      const o = (y * png.w + x) * png.ch, r = png.data[o], g = png.data[o + 1], b = png.data[o + 2];
      if (Math.abs(r - 143) < 40 && Math.abs(g - 162) < 40 && Math.abs(b - 196) < 40) barPx++;
    }
  }
  return { sat: sat, satUpper: satUpper, gband: gband, winLift: winLift, barPx: barPx };
}

function stepPixelsLaplace() {
  const p = PAGES.find(x => x.key === 'laplace');
  if (!selected.includes(p) || !CHROME) return;
  const rect = lastRect.laplace;
  if (!rect) { report('skip', 'pixels laplace', '无画布矩形（探针未过）'); return; }
  if (!lastViz.laplace) { report('skip', 'pixels laplace', '未迁移（无 __VIZ 句柄）'); return; }
  const html = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
  const i = html.lastIndexOf('</body>');
  const tmpHtml = path.join(ROOT, '_shot_laplace.html');
  const tmpPng = path.join(os.tmpdir(), 'laplace_shot_' + process.pid + '.png');
  fs.writeFileSync(tmpHtml, html.slice(0, i) + PROBE_SNIPPET + html.slice(i), 'utf8');
  try {
    const url = 'file:///' + tmpHtml.replace(/\\/g, '/');
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--window-size=1600,900',
      '--run-all-compositor-stages-before-draw', '--virtual-time-budget=4000',
      '--screenshot=' + tmpPng, url], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0 || !fs.existsSync(tmpPng)) { report('FAIL', 'pixels laplace', '截图失败 ' + (r.stderr || '').slice(0, 200)); return; }
    const png = readPng(tmpPng);
    const s = scanPixelsLaplace(png, rect);
    const bad = [];
    if (s.sat <= LIT_PIXEL.satMin) bad.push('sat=' + s.sat);
    if (s.satUpper <= LIT_PIXEL.satUpperMin) bad.push('satUpper=' + s.satUpper);
    if (s.gband <= LIT_PIXEL.gbandMin) bad.push('gband=' + s.gband);
    if (s.winLift <= LIT_PIXEL.winLiftMin) bad.push('winLift=' + s.winLift);
    if (s.barPx <= LIT_PIXEL.barPxMin) bad.push('barPx=' + s.barPx);
    const detail = 'sat=' + s.sat + ' satUpper=' + s.satUpper + ' gband=' + s.gband + ' winLift=' + s.winLift + ' barPx=' + s.barPx;
    report(bad.length === 0 ? 'ok' : 'FAIL', 'pixels laplace', detail + (bad.length ? '  不符: ' + bad.join(',') : ''));
  } catch (e) {
    report('FAIL', 'pixels laplace', e.message);
  } finally {
    try { fs.unlinkSync(tmpHtml); } catch (e) { /* ignore */ }
    try { fs.unlinkSync(tmpPng); } catch (e) { /* ignore */ }
  }
}

/* ============ 步骤 C2：自定义信号（custom 预设）真渲染 ============ */
/* 只跑拉普拉斯页：切到自定义 f(t)，用页面内 getImageData 量"时域观测窗内离轴 ≥20px 的亮青像素"。
   自定义信号的 X 是数值求积来的，这条探针确认它真的画得出有高度的曲线（不是被压成一条直线）。 */
const CUSTOM_PROBE = `
<style>.stage{flex:none;width:1242px;height:730px}</style>
<script>
(function(){
  var info='PROBE';
  try{
    var H=window.__LIT,V=window.__VIZ;
    V.st.playing=false;
    H.apply({preset:'custom',fstr:'exp(-a*t)*sin(w0*t)*u(t)',p:1,w0:2,sig:0.5,dw:0.05,omxUnits:8});
    var C=H.cus(), C2=H.comp();
    var cv=document.getElementById('cv'), g=cv.getContext('2d'), R=H.rects();
    var Xw=H.curve().Xw, Tw=C.tail, dpr=Math.min(window.devicePixelRatio||1,2);
    var yax=(R.time.y+R.time.h/2)*dpr, far=0;
    for(var y=Math.round(R.time.y*dpr)+2;y<Math.round((R.time.y+R.time.h)*dpr)-2;y++){
      if(Math.abs(y-yax)<=20) continue;
      for(var x=Math.round((R.time.x+R.time.w*(-Tw+Xw)/(2*Xw))*dpr);x<Math.round((R.time.x+R.time.w*(Tw+Xw)/(2*Xw))*dpr);x++){
        var d=g.getImageData(x,y,1,1).data;
        if(d[2]>200&&d[0]>90&&d[0]<210&&d[1]>150&&d[1]<235) far++;
      }
    }
    info+=' expr='+C.src+' err='+(C.err||'none')+' Tw='+C.tail.toFixed(2)+' N='+C2.N+' lift='+far+' viz='+(V?'1':'0');
  }catch(e){ info+=' throw='+e.message; }
  document.title=info;
})();
</script>
`;
const CUSTOM_LIFT_MIN = 80;

function stepCustomProbe() {
  const p = PAGES.find(x => x.key === 'laplace');
  if (!selected.includes(p) || !CHROME) return;
  if (!fs.existsSync(path.join(ROOT, p.file))) { report('skip', 'probe custom', '页面不存在'); return; }
  const html = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
  const i = html.lastIndexOf('</body>');
  if (i < 0) { report('FAIL', 'probe custom', '无 </body>'); return; }
  const tmp = path.join(ROOT, '_probe_custom.html');
  fs.writeFileSync(tmp, html.slice(0, i) + CUSTOM_PROBE + html.slice(i), 'utf8');
  try {
    const url = 'file:///' + tmp.replace(/\\/g, '/');
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--allow-file-access-from-files',
      '--window-size=1600,900', '--virtual-time-budget=4000', '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 180000 });
    const m = (r.stdout || '').match(/<title>([\s\S]*?)<\/title>/);
    const title = m ? m[1] : '';
    if (!/^PROBE/.test(title)) { report('FAIL', 'probe custom', 'title 未写入: ' + title.slice(0, 120)); return; }
    const threw = title.match(/throw=([^ ]*)/);
    if (threw) { report('FAIL', 'probe custom', '探针抛错 ' + threw[1]); return; }
    if (/err=(?!none)/.test(title)) { report('FAIL', 'probe custom', '表达式报错 ' + title); return; }
    const lift = title.match(/lift=(\d+)/);
    if (!lift) { report('FAIL', 'probe custom', '未量到 lift: ' + title); return; }
    const bad = [];
    if (+lift[1] <= CUSTOM_LIFT_MIN) bad.push('lift=' + lift[1]);
    if (!/viz=1/.test(title)) bad.push('无 __VIZ');
    report(bad.length === 0 ? 'ok' : 'FAIL', 'probe custom', title + (bad.length ? '  不符: ' + bad.join(',') : ''));
  } finally {
    try { fs.unlinkSync(tmp); } catch (e) { /* ignore */ }
  }
}

stepSyntax();
stepExpr();
stepTex();
stepStubMath();
stepStubMathLaplace();
stepProbes();
stepPixels();
stepPixelsLaplace();
stepCustomProbe();

const failed = results.filter(r => r.status === 'FAIL');
console.log(failed.length === 0 ? '\nALL CHECKS PASSED (' + results.length + ' items)' : '\nFAILED: ' + failed.length + ' items');
process.exit(failed.length === 0 ? 0 : 1);
