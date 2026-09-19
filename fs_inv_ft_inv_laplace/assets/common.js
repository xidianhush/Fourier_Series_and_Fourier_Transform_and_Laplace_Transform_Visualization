/* 共享工具：四个可视化页面都在页面脚本之前加载本文件（<script src="assets/common.js">）。
   以全局函数形式暴露，页面 IIFE 内直接引用即可。 */
(function (g) {
  'use strict';

  function colFor(k) { return 'hsl(' + (190 + 150 * k).toFixed(0) + ',85%,62%)'; }

  function fmt(v, d) { return (Math.abs(v) < 1e-12 ? 0 : v).toFixed(d === undefined ? 3 : d); }

  function fmtG(val) {
    if (!isFinite(val)) return '∞';
    if (val >= 1e5) return val.toExponential(1);
    if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
    if (val >= 100) return val.toFixed(0);
    return val.toFixed(1);
  }

  function bucketOf(n, N) { var b = Math.floor(24 * Math.abs(n) / (N || 1)); if (b > 23) b = 23; return b; }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* 把 mouse 三件套换成 Pointer Events：触屏/手写笔可用，鼠标行为不变。
     handlers: {down(e), move(e), up(e)}；down 之后尝试 setPointerCapture 以便拖出画布仍收到 move/up。 */
  function attachPointer(cv, handlers) {
    cv.addEventListener('pointerdown', function (e) {
      if (handlers.down) handlers.down(e);
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 旧浏览器无此 API 时退化为普通事件 */ }
    });
    cv.addEventListener('pointermove', function (e) { if (handlers.move) handlers.move(e); });
    var up = function (e) { if (handlers.up) handlers.up(e); };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  /* 页面脚本抛错时在顶部显示红条，避免"打开空白却无任何提示"。 */
  function installErrorBanner() {
    if (!g.document || g.document.getElementById('errbar')) return;
    var bar = g.document.createElement('div');
    bar.id = 'errbar';
    bar.className = 'errbar';
    bar.setAttribute('role', 'alert');
    g.document.body.appendChild(bar);
    var show = function (msg) {
      bar.textContent = '页面脚本出错：' + msg;
      bar.classList.add('on');
    };
    g.addEventListener('error', function (e) { show(e.message || String(e.error || e)); });
    g.addEventListener('unhandledrejection', function (e) {
      show(String((e.reason && e.reason.message) || e.reason));
    });
  }

  g.colFor = colFor;
  g.fmt = fmt;
  g.fmtG = fmtG;
  g.bucketOf = bucketOf;
  g.clamp = clamp;
  g.attachPointer = attachPointer;
  g.installErrorBanner = installErrorBanner;

  if (g.document && g.document.body) installErrorBanner();
  else g.addEventListener('DOMContentLoaded', installErrorBanner);
})(window);
