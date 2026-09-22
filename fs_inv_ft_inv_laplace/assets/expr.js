/* 极简表达式解析器：把用户输入的 f(t) 文本编译成数值求值函数。
   零依赖、不 eval 用户字符串（不用 eval / new Function），函数与常量走白名单。
   被拉普拉斯反变换页用来支持"自定义信号"（assets/laplace.js 的数值 X 求积）。
   用法：
     var r = parseExpr('exp(-a*t)*sin(w0*t)*u(t)');
     r.ok            // 语法是否通过
     r.err           // 出错时的英文提示（含出错位置）
     r.used          // {t:1,a:1,w0:1} —— 表达式里实际用到的变量
     r.at(t, env)    // 数值求值；env = {a:1, w0:2}
   语法：+ - * / ^（也接受 **）、括号、一元 ±、隐式乘法（2t、3sin(t)、2(t+1)）、
        常量 pi/π/e/tau、变量 t/a/w0（也认 ω0）、函数见 FUNCS。 */
(function (g) {
  'use strict';

  function hs(x) { return x < 0 ? 0 : (x > 0 ? 1 : 0.5); }

  var FUNCS = {
    exp: Math.exp, sqrt: Math.sqrt, cbrt: function (x) { return Math.cbrt(x); }, abs: Math.abs,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, atan2: Math.atan2,
    log: Math.log, log10: function (x) { return Math.log(x) / Math.LN10; }, log2: function (x) { return Math.log(x) / Math.LN2; },
    floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: function (x) { return Math.sign ? Math.sign(x) : (x > 0 ? 1 : (x < 0 ? -1 : 0)); },
    min: Math.min, max: Math.max, pow: Math.pow, hypot: Math.hypot,
    heaviside: hs, u: hs, step: hs, theta: hs, ramp: function (x) { return x > 0 ? x : 0; }
  };
  /* 两个参数的函数（其余按一元函数处理）：多参数写成 pow(t,2) 或直接 t^2 */
  var AR2 = { pow: 1, min: 1, max: 1, hypot: 1, atan2: 1 };

  var CONSTS = { pi: Math.PI, 'π': Math.PI, e: Math.E, tau: 2 * Math.PI };
  var VARS = { t: 1, a: 1, w0: 1, 'ω0': 1 };   /* ω0 是 w0 的别名 */

  var MAXLEN = 240, MAXDEPTH = 48;
  var ZERO_ENV = { a: 1, w0: 1 };

  function isIdStart(c) { return /[A-Za-z_µ\u0370-\u03ff]/.test(c); }
  function isIdPart(c) { return /[A-Za-z0-9_\u0370-\u03ff]/.test(c); }
  function isDigit(c) { return c >= '0' && c <= '9'; }

  /* 输入宽容化：LaTeX 味的 \left( \sin \, { } [ ] 全角括号 − × ÷ 都收下（不是 LaTeX 解析，只是把常见写法掰成迷你语法） */
  function normalize(src) {
    return String(src == null ? '' : src)
      .replace(/\\left|\\right/g, '')
      .replace(/\\[,;:!]/g, ' ')
      .replace(/\\([A-Za-z]+)/g, '$1')
      .replace(/[（]/g, '(').replace(/[）]/g, ')')
      .replace(/[{\[]/g, '(').replace(/[}\]]/g, ')')
      .replace(/[×]/g, '*').replace(/[÷]/g, '/')
      .replace(/[−–—]/g, '-')
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ');
  }

  function parseExpr(src) {
    var out = { ok: false, err: null, src: String(src == null ? '' : src), used: {}, at: null };
    var s = normalize(out.src);
    if (!s.trim()) { out.err = 'empty expression'; return out; }
    if (s.trim().length > MAXLEN) { out.err = 'expression too long (max ' + MAXLEN + ' chars)'; return out; }

    var pos = 0, depth = 0;

    function err(msg) { var e = new Error(msg); e.__parse = true; throw e; }
    function ws() { while (s[pos] === ' ') pos++; }
    function peek() { ws(); return s[pos]; }
    function eat(c) { if (peek() === c) { pos++; return true; } return false; }

    function readNumber() {
      var st = pos;
      while (isDigit(s[pos])) pos++;
      if (s[pos] === '.') { pos++; while (isDigit(s[pos])) pos++; }
      if ((s[pos] === 'e' || s[pos] === 'E') && (isDigit(s[pos + 1]) || ((s[pos + 1] === '+' || s[pos + 1] === '-') && isDigit(s[pos + 2])))) {
        pos++; if (s[pos] === '+' || s[pos] === '-') pos++;
        while (isDigit(s[pos])) pos++;
      }
      var v = parseFloat(s.slice(st, pos));
      return function () { return v; };
    }
    function readIdent() {
      var st = pos;
      pos++;
      while (pos < s.length && isIdPart(s[pos])) pos++;
      return s.slice(st, pos);
    }

    function parseAdd() {
      var L = parseMul();
      for (; ; ) {
        var c = peek();
        if (c === '+') { pos++; var R1 = parseMul(); L = (function (A, B) { return function (t, env) { return A(t, env) + B(t, env); }; })(L, R1); }
        else if (c === '-') { pos++; var R2 = parseMul(); L = (function (A, B) { return function (t, env) { return A(t, env) - B(t, env); }; })(L, R2); }
        else return L;
      }
    }
    function startsAtom(c) { return c !== undefined && (isIdStart(c) || c === '(' || c === '.'); }
    function parseMul() {
      var L = parseUnary();
      for (; ; ) {
        var c = peek();
        if (c === '*') {
          if (s[pos + 1] === '*') err('"**" can only be used as the power operator here');
          pos++;
          var R = parseUnary();
          L = (function (A, B) { return function (t, env) { return A(t, env) * B(t, env); }; })(L, R);
        } else if (c === '/') {
          pos++;
          var R2 = parseUnary();
          L = (function (A, B) { return function (t, env) { return A(t, env) / B(t, env); }; })(L, R2);
        } else if (startsAtom(c)) {
          /* 隐式乘法：2t、3sin(t)、2(t+1)、t(t-1) */
          var R3 = parseUnary();
          L = (function (A, B) { return function (t, env) { return A(t, env) * B(t, env); }; })(L, R3);
        } else return L;
      }
    }
    function parseUnary() {
      var c = peek();
      if (c === '-') { pos++; var A = parseUnary(); return function (t, env) { return -A(t, env); }; }
      if (c === '+') { pos++; return parseUnary(); }
      return parsePower();
    }
    function parsePower() {
      var base = parseAtom();
      var c = peek();
      if (c === '^' || (c === '*' && s[pos + 1] === '*')) {
        pos += (c === '^' ? 1 : 2);
        var ex = parseUnary();     /* 右结合，且 -t^2 = -(t^2)、2^-1 可用 */
        return (function (A, B) { return function (t, env) { return Math.pow(A(t, env), B(t, env)); }; })(base, ex);
      }
      return base;
    }
    function parseAtom() {
      if (depth++ > MAXDEPTH) err('parentheses nested too deeply');
      var c = peek(), node;
      if (c === undefined) err('expression ends here (missing operand)');
      if (c === '(') {
        pos++;
        node = parseAdd();
        if (!eat(')')) err('unclosed parenthesis');
      } else if (isDigit(c) || (c === '.' && isDigit(s[pos + 1]))) {
        node = readNumber();
      } else if (c === '.' && !isDigit(s[pos + 1])) {
        err('stray decimal point here');
      } else if (isIdStart(c)) {
        var name = readIdent();
        if (peek() === '(') {
          pos++;
          var args = [parseAdd()];
          while (eat(',')) args.push(parseAdd());
          if (!eat(')')) err('unclosed parenthesis in call to ' + name);
          var fn = FUNCS[name];
          if (!fn) err('unknown function ' + name + ' (available: ' + Object.keys(FUNCS).join(' ') + ')');
          var n2 = AR2[name] ? 2 : 1;
          if (args.length !== n2) err('function ' + name + ' expects ' + n2 + ' argument(s), got ' + args.length);
          node = n2 === 2
            ? (function (A, B, f) { return function (t, env) { return f(A(t, env), B(t, env)); }; })(args[0], args[1], fn)
            : (function (A, f) { return function (t, env) { return f(A(t, env)); }; })(args[0], fn);
        } else if (VARS[name]) {
          var key = name === 'ω0' ? 'w0' : name;
          out.used[key] = 1;
          if (key === 't') node = function (t) { return t; };
          else node = (function (k) { return function (t, env) { return env[k]; }; })(key);
        } else if (Object.prototype.hasOwnProperty.call(CONSTS, name)) {
          var cv = CONSTS[name];
          node = function () { return cv; };
        } else {
          err('unknown symbol ' + name + ' (variables: t a w0; constants: pi e tau; if ' + name + ' is a function, write ' + name + '(...))');
        }
      } else {
        err('unrecognized character "' + c + '"');
      }
      depth--;
      return node;
    }

    try {
      var root = parseAdd();
      ws();
      if (pos < s.length) err('unexpected extra input at character ' + (pos + 1) + ': "' + s.slice(pos, pos + 12) + '"');
      out.at = function (t, env) { return root(t, env || ZERO_ENV); };
      out.ok = true;
      return out;
    } catch (e) {
      if (e && e.__parse) out.err = e.message;
      else out.err = 'parse failed: ' + (e && e.message ? e.message : String(e));
      return out;
    } finally {
      depth = 0;
    }
  }

  /* 供 UI 提示用：不重复列长表，只给出最常用的一小撮 */
  parseExpr.tips = 'variables t a w0; constants pi π e tau; functions exp sin cos tan sqrt abs log log10 sinh cosh tanh heaviside (or u) sign min max pow hypot; operators + - * / ^ (also **) and implicit multiplication like 2t, 3sin(t)';

  g.parseExpr = parseExpr;
})(window);
