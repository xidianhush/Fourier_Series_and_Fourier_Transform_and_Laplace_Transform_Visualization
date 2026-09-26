/* 全站导航抽屉（Drawer）：仓库根共用一份。
   各页在 </body> 前写 <script src="…/drawer.js" defer></script>（相对路径，'assets/…' 或 '../assets/…'）。
   相对前缀从本脚本自己的 src 属性推出来，所以下面 NAV 里的路径一律按「仓库根相对」书写，
   输出的 href 仍是纯相对路径 —— file:// 直接打开与 GitHub Pages 子路径部署都成立。
   本脚本不依赖任何页面内全局（__VIZ / __IFT / __LIT / __FT 一律不碰），出任何错只 console.error，
   绝不让导航把可视化页拖挂。 */
(function () {
  'use strict';
  try {
    /* —— 页面清单：name = 英文条目名，path = 仓库根相对路径，tag = 可选的灰色注记 —— */
    var NAV = [
      { name: 'Overview', path: 'index.html' },
      { group: true, name: 'Sub-site ① · Fourier & Laplace transforms', path: 'ft_laplace/index.html' },
      { name: 'Fourier transform — winding machine / centroid', path: 'ft_laplace/fourier_transform.html' },
      { name: 'Laplace transform — σ envelope / poles / ROC', path: 'ft_laplace/laplace_transform.html' },
      { name: 'Notebook — A Visual Introduction', path: 'ft_laplace/Fourier%20Transform%20-%20A%20Visual%20Introduction.ipynb', tag: 'notebook, not a web page' },
      { group: true, name: 'Sub-site ② · Fourier series & inverse transforms', path: 'fs_inv_ft_inv_laplace/index.html' },
      { name: '① Fourier series — linear superposition', path: 'fs_inv_ft_inv_laplace/Fourier_series_linear_superposition.html' },
      { name: '② From Fourier series to Fourier transform', path: 'fs_inv_ft_inv_laplace/From_Fourier_series_to_Fourier_transform.html' },
      { name: '③ Inverse Fourier transform synthesis', path: 'fs_inv_ft_inv_laplace/Fourier_inverse_transform_synthesis.html' },
      { name: '④ Inverse Laplace transform synthesis', path: 'fs_inv_ft_inv_laplace/Laplace_inverse_transform_synthesis.html' }
    ];

    var el = document.currentScript || document.querySelector('script[src$="drawer.js"]');
    var src = (el && el.getAttribute('src')) || 'assets/drawer.js';
    /* 'assets/drawer.js'（根页）→ ''；'../assets/drawer.js'（子目录页）→ '../'。异常时退回根页口径。 */
    var up = src.replace(/assets\/drawer\.js.*$/, '');
    if (!/^(\.\.\/)*$/.test(up)) up = '';
    var depth = (up.match(/\.\.\//g) || []).length;

    /* 本页相对仓库根的路径，用于高亮当前条目（比较前统一 decode，路径里的 %20 会还原成空格）。 */
    var segs = decodeURI(location.pathname).split('/').filter(Boolean);
    var cur = segs.slice(Math.max(0, segs.length - depth - 1)).join('/');

    function esc(t) {
      return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var items = NAV.map(function (e) {
      var shown = (e.group ? e.path.replace(/%20/g, ' ') + ' — hub page' : e.path.replace(/%20/g, ' '));
      return '<a class="dnav-item' + (e.group ? ' dnav-group' : '') + '"' +
        (decodeURI(e.path) === cur ? ' aria-current="page"' : '') +
        ' href="' + esc(up + e.path) + '">' +
        '<span class="dnav-item-name">' + esc(e.name) + '</span>' +
        '<span class="dnav-item-path">' + esc(shown) + '</span>' +
        (e.tag ? '<span class="dnav-tag">' + esc(e.tag) + '</span>' : '') +
        '</a>';
    }).join('');

    document.body.insertAdjacentHTML('beforeend',
      '<nav class="dnav" id="dnav" aria-label="Pages in this site">' +
        '<button type="button" class="dnav-toggle" id="dnavToggle" aria-expanded="false"' +
          ' aria-controls="dnavPanel" aria-label="Page list" title="Page list">' +
          '<svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true" focusable="false">' +
            '<path class="dnav-bar" d="M1 2h18M1 7h18M1 12h10"/>' +
            '<path class="dnav-dot" d="M15.6 10.2v3.2"/>' +
          '</svg>' +
        '</button>' +
        '<div class="dnav-panel" id="dnavPanel">' +
          '<p class="dnav-head">Pages</p>' + items +
        '</div>' +
      '</nav>');

    var nav = document.getElementById('dnav');
    var panel = document.getElementById('dnavPanel');
    var btn = document.getElementById('dnavToggle');
    var pinned = false;
    var timer = 0;

    function setOpen(on) {
      nav.classList.toggle('open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    function isOpen() { return nav.classList.contains('open'); }
    function open() { clearTimeout(timer); timer = 0; setOpen(true); }
    function close() { if (!pinned) setOpen(false); }
    function soon() { clearTimeout(timer); timer = setTimeout(close, 140); }

    /* 悬停图标即滑出；指针停在图标条或面板内就不会收起（面板是 .dnav 的后代）。 */
    btn.addEventListener('mouseenter', open);
    btn.addEventListener('focus', open);
    panel.addEventListener('mouseenter', open);
    nav.addEventListener('mouseleave', soon);
    /* 点击图标钉住/取消钉住；Esc 关闭并把焦点交还图标。 */
    btn.addEventListener('click', function () {
      pinned = !pinned;
      if (pinned) { open(); } else { setOpen(false); }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && isOpen()) {
        pinned = false;
        setOpen(false);
        btn.focus();
      }
    });
  } catch (err) {
    if (window.console && console.error) console.error('drawer navigation failed:', err);
  }
})();