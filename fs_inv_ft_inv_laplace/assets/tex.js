/* 极简 TeX 子集渲染器：把页面里写的 TeX 片段排成 HTML，**零依赖、不联网**（不是 KaTeX/MathJax 引擎）。
   用法：把公式写成元素自身的文本，
     <span class="tex">\frac{1}{2\pi j}\int_{\sigma-j\infty}^{\sigma+j\infty}X(s)e^{st}\,ds</span>
     <div class="tex-block">…</div>
   本文件在加载时（DOMContentLoaded）把 .tex / .tex-block 的文本渲染成 HTML；JS 未启用时读者看到的是
   TeX 源码本身，配合各页的 <noscript> 提示不至于空白。
   支持的子集：\frac \sqrt \text/\mathrm、上下标 ^ _（\sum \prod \lim 的上下限竖排、\int 用右下角上下标）、
   常用希腊字母与算符（\sigma \omega \Delta \pi \infty \to \cdot \times \pm \le \ge \ne \approx \partial …
   以及 \sin \cos \exp \log \lim \max \min \arg \Re \Im）、\left \right \bigl \bigr（只当括号用）、
   \, \; \: \! \quad 空格、\{ \} \% \& \# \_ 转义。
   渲染失败（未知命令、括号不配对）时输出带 .texerr 的原样文本 + 红色虚线框，方便一眼看见写错了。 */
(function (g) {
  'use strict';

  /* 命令 → 显示字符。希腊字母按数学习惯用斜体（在 CSS 里统一处理）。 */
  var SYM = {
    alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', varepsilon:'ε', zeta:'ζ', eta:'η',
    theta:'θ', vartheta:'ϑ', iota:'ι', kappa:'κ', lambda:'λ', mu:'μ', nu:'ν', xi:'ξ', pi:'π',
    varpi:'ϖ', rho:'ρ', sigma:'σ', varsigma:'ς', tau:'τ', upsilon:'υ', phi:'φ', varphi:'φ',
    chi:'χ', psi:'ψ', omega:'ω', Gamma:'Γ', Delta:'Δ', Theta:'Θ', Lambda:'Λ', Xi:'Ξ', Pi:'Π',
    Sigma:'Σ', Upsilon:'Υ', Phi:'Φ', Psi:'Ψ', Omega:'Ω',
    cdot:'·', times:'×', div:'÷', pm:'±', mp:'∓', ast:'∗', star:'⋆',
    le:'≤', leq:'≤', ge:'≥', geq:'≥', ne:'≠', neq:'≠', approx:'≈', equiv:'≡', sim:'∼', simeq:'≃',
    propto:'∝', to:'→', rightarrow:'→', leftarrow:'←', leftrightarrow:'↔', mapsto:'↦', implies:'⟹',
    infty:'∞', partial:'∂', nabla:'∇', sum:'∑', prod:'∏', int:'∫', oint:'∮', sqrt:'√',
    in:'∈', notin:'∉', subset:'⊂', subseteq:'⊆', cup:'∪', cap:'∩', forall:'∀', exists:'∃',
    ldots:'…', cdots:'⋯', vdots:'⋮', ddots:'⋱', angle:'∠', perp:'⊥', prime:'′', circ:'∘',
    lfloor:'⌊', rfloor:'⌋', lceil:'⌈', rceil:'⌉', langle:'⟨', rangle:'⟩', hbar:'ℏ', ell:'ℓ'
  };
  /* 直立排版的函数名 / 算符名 */
  var FN = {
    sin:1, cos:1, tan:1, cot:1, sec:1, csc:1, arcsin:1, arccos:1, arctan:1,
    sinh:1, cosh:1, tanh:1, exp:1, log:1, ln:1, lg:1, lim:1, limsup:1, liminf:1,
    max:1, min:1, sup:1, inf:1, arg:1, det:1, dim:1, ker:1, deg:1, gcd:1, sgn:1, mod:1
  };
  var BIGSTACK = { sum:1, prod:1, lim:1, limsup:1, liminf:1, max:1, min:1, sup:1, inf:1 };   /* 上下限竖排 */
  var STACKRE = /data-big="(sum|prod|lim|limsup|liminf|max|min|sup|inf)"/;
  var REL = { '=':1, '<':1, '>':1, '≤':1, '≥':1, '≠':1, '≈':1, '≡':1, '∼':1, '≃':1, '→':1, '←':1, '↔':1, '↦':1, '⟹':1, '∝':1, '∈':1, '∉':1, '⊂':1, '⊆':1 };
  var BIN = { '+':1, '−':1, '-':1, '±':1, '∓':1, '·':1, '×':1, '÷':1, '∗':1, '⋆':1, '∪':1, '∩':1 };

  function esc(c) { return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : c; }
  function escAll(s) { return String(s).replace(/[&<>"]/g, esc); }

  function renderTex(src) {
    var s = String(src == null ? '' : src).trim();
    var pos = 0;

    function fail(msg) { var e = new Error(msg); e.tex = true; throw e; }
    function token() {
      if (pos >= s.length) return null;
      var c = s[pos];
      if (c === '\\') {
        pos++;
        if (pos >= s.length) fail('反斜杠后面什么都没有');
        var m = /^[A-Za-z]+/.exec(s.slice(pos));
        if (m) { pos += m[0].length; return { t: 'cmd', v: m[0] }; }
        var ch = s[pos]; pos++;
        return { t: 'esc', v: ch };
      }
      pos++;
      if (c === '{') return { t: '{' };
      if (c === '}') return { t: '}' };
      if (c === '^') return { t: '^' };
      if (c === '_') return { t: '_' };
      return { t: 'ch', v: c };
    }

    /* 取一个"原子"（不带上标下标）：{...} / \cmd / 单字符 */
    function atom(tok) {
      if (!tok) fail('缺参数');
      if (tok.t === '{') return group();
      if (tok.t === '}') fail('多余的右花括号');
      if (tok.t === '^' || tok.t === '_') fail('上下标的顺序不对（缺前面的原子）');
      return one(tok);
    }
    /* 一个 {} 组：内部按顺序解析，返回 HTML */
    function group() {
      var out = '';
      for (;;) {
        var tk = token();
        if (!tk) fail('花括号没有闭合');
        if (tk.t === '}') return out;
        out += node(tk);
      }
    }
    /* 单个 token → HTML（含跟随其后的上下标） */
    function node(tk) {
      var html = one(tk);
      var sup = null, sub = null, guard = 0;
      for (;;) {
        var save = pos, nx = token();
        if (nx && (nx.t === '^' || nx.t === '_')) {
          var arg = atom(token());
          if (nx.t === '^') { if (sup !== null) fail('同一个原子有两个上标'); sup = arg; }
          else { if (sub !== null) fail('同一个原子有两个下标'); sub = arg; }
        } else { pos = save; break; }
        if (++guard > 4) fail('上下标套得太多');
      }
      if (sup === null && sub === null) return html;
      if (STACKRE.test(html)) {
        return '<span class="mstack"><span class="mup">' + (sup || '') + '</span>' + html +
          '<span class="mdn">' + (sub || '') + '</span></span>';
      }
      return html + (sub ? '<sub>' + sub + '</sub>' : '') + (sup ? '<sup>' + sup + '</sup>' : '');
    }
    /* token → 最基础的 HTML */
    function one(tk) {
      if (tk.t === '{') { var g2 = group(); return '<span class="mgrp">' + g2 + '</span>'; }
      if (tk.t === 'esc') {
        if (tk.v === ',') return '<span class="msp0"></span>';
        if (tk.v === ':' || tk.v === ';') return '<span class="msp1"></span>';
        if (tk.v === '!') return '';
        if (tk.v === ' ') return '<span class="msp0"></span>';
        var q = { '{': '{', '}': '}', '%': '%', '&': '&', '#': '#', '_': '_', '$': '$', '\\': '' }[tk.v];
        if (q === undefined) fail('不认识 \\' + tk.v);
        return escAll(q);
      }
      if (tk.t === 'cmd') {
        var v = tk.v;
        if (v === 'frac') {
          var a = atom(token()), b = atom(token());
          return '<span class="mfrac"><span class="mnum">' + a + '</span><span class="mden">' + b + '</span></span>';
        }
        if (v === 'sqrt') {
          var r = atom(token());
          return '<span class="msqrt"><span class="mrad">√</span><span class="mbody">' + r + '</span></span>';
        }
        if (v === 'text' || v === 'mathrm' || v === 'operatorname' || v === 'mbox') {
          var t = token();
          if (!t || t.t !== '{') fail('\\' + v + ' 后面要跟 {…}');
          var raw = '';
          for (;;) {
            var tk2 = token();
            if (!tk2) fail('\\' + v + ' 的花括号没有闭合');
            if (tk2.t === '}') break;
            raw += tk2.t === 'cmd' ? '\\' + tk2.v : tk2.t === 'esc' ? '\\' + tk2.v : (tk2.v !== undefined ? tk2.v : (tk2.t === '{' ? '{' : '}'));
          }
          return '<span class="mtext">' + escAll(raw) + '</span>';
        }
        if (v === 'left' || v === 'right' || v === 'bigl' || v === 'bigr' || v === 'Bigl' || v === 'Bigr' || v === 'big' || v === 'Big' || v === 'bigg' || v === 'Bigg') {
          return '';                                   /* 只当括号用，本身不排 */
        }
        if (v === 'limits' || v === 'nolimits' || v === 'displaystyle' || v === 'textstyle') return '';
        if (v === 'quad') return '<span class="msp1"></span>';
        if (v === 'qquad') return '<span class="msp2"></span>';
        if (v === ',' || v === ':' || v === ';') return '<span class="msp0"></span>';
        if (v === '!') return '';
        if (SYM[v] !== undefined) {
          var ch = SYM[v];
          var isBig = ch === '∑' || ch === '∏' || ch === '∫' || ch === '∮';
          var cls = (isBig ? 'mop' : (FN[v] ? 'mfn' : (REL[ch] ? 'mrel' : (BIN[ch] ? 'mbin' : 'msym'))));
          return '<span class="' + cls + '"' + (isBig ? ' data-big="' + v + '"' : '') + '>' + escAll(ch) + '</span>' +
            (cls === 'mrel' || cls === 'mbin' ? '<wbr>' : '');
        }
        if (FN[v]) return '<span class="mfn"' + (BIGSTACK[v] ? ' data-big="' + v + '"' : '') + '>' + v + '</span><span class="msp0"></span>';
        fail('不认识的命令 \\' + v);
      }
      /* 普通字符：连续字母裹成斜体变量；数字/括号等原样 */
      return plain(tk.v);
    }
    function plain(c) {
      if (/[A-Za-z]/.test(c)) {
        var m = /^[A-Za-z]+/.exec(s.slice(pos - 1));
        if (m) {
          pos += m[0].length - 1;
          return '<i>' + m[0] + '</i>';
        }
        return '<i>' + c + '</i>';
      }
      if (c === ' ') return '<span class="msp0"></span>';
      var cc = c === '-' ? '−' : c;                     /* 数学模式里减号用 U+2212（TeX 同款） */
      var cls = REL[cc] ? 'mrel' : (BIN[cc] ? 'mbin' : null);
      /* 关系/二元算符后面给一个换行机会（<wbr>），长公式才能自动折行；分式/竖排内部已 nowrap */
      return cls ? '<span class="' + cls + '">' + escAll(cc) + '</span>' + (cls === 'mrel' || cls === 'mbin' ? '<wbr>' : '') : escAll(cc);
    }

    var html = '';
    try {
      for (;;) {
        var tk = token();
        if (!tk) break;
        if (tk.t === '}') fail('多余的右花括号');
        html += node(tk);
      }
    } catch (e) {
      if (e && e.tex) return '<span class="texerr" title="' + escAll(e.message) + '">' + escAll(s) + '</span>';
      throw e;
    }
    return html;
  }

  /* 把页面里 .tex / .tex-block 的文本渲染掉；已渲染过的加 data-tex-done 避免重复。
     .tex-block 自动补上 .tex 类，这样 CSS 只需写一套 .tex … 规则。 */
  function texify(root) {
    var doc = (root || g.document);
    if (!doc || !doc.querySelectorAll) return 0;
    var list = doc.querySelectorAll('.tex,.tex-block'), n = 0;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.getAttribute('data-tex-done')) continue;
      if (/(^|\s)tex-block(\s|$)/.test(el.className) && !/(^|\s)tex(\s|$)/.test(el.className)) el.className += ' tex';
      var src = el.textContent;
      el.innerHTML = renderTex(src);
      el.setAttribute('data-tex-done', '1');
      n++;
    }
    return n;
  }

  g.renderTex = renderTex;
  g.texify = texify;
  if (g.document) {
    if (g.document.readyState === 'loading') g.document.addEventListener('DOMContentLoaded', function () { texify(); });
    else texify();
  }
})(window);
