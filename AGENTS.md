# AGENTS.md

本文件供 AI 编码代理阅读，目的是让不了解本项目的读者快速掌握项目全貌。阅读者被假定对本项目一无所知。

## 项目概述

这是一个**零构建的静态教学站点**，主题是《信号与系统》里的傅里叶变换、傅里叶级数与拉普拉斯变换。仓库根目录是一个总览页，两个子项目分别提供两套交互式可视化（HTML5 Canvas + 原生 JavaScript），另附一个 Jupyter notebook 版。

总仓库由两个原本各自独立的 Git 仓库于 2026-09 合并而成（见下文「版本控制」）。两个子项目**互不依赖**，页面之间没有共享代码，改动其一时不需要动另一个。

| 位置 | 内容 | 入口 |
| --- | --- | --- |
| 根目录 `index.html` | 总览页，两张卡片分别指向两个子项目的枢纽页 | `index.html` |
| `ft_laplace/` | 傅里叶变换（缠绕机 / 质心法）与拉普拉斯变换（σ 包络、极点、收敛域），外加 Python notebook 版 | `ft_laplace/index.html` |
| `fs_inv_ft_inv_laplace/` | 傅里叶级数线性叠加、级数→变换过渡、傅里叶反变换合成、拉普拉斯反变换合成 | `fs_inv_ft_inv_laplace/index.html` |

## 关键事实速查

- **没有任何构建系统、包管理器或配置文件**：全仓库不存在 `package.json`、`pyproject.toml`、`requirements.txt`、`Cargo.toml`、`Makefile`、CI 工作流等（已实测确认）。任何"先安装依赖再构建"的思路在这里都不适用。
- 页面全部是静态 HTML + 内联或同目录的 CSS/JS，用浏览器直接打开即可运行。
- 唯一的工具链脚本是 `fs_inv_ft_inv_laplace/tools/check.js`（Node.js，无 npm 依赖，只用 Node 内置模块）。
- 唯一的 Python 交付物是 `ft_laplace/Fourier Transform - A Visual Introduction.ipynb`（**文件名带空格**）。
- 除 notebook 外，代码里没有符号运算、没有后端、没有数据库、没有构建产物目录。

## 目录结构与模块划分

```
（仓库根）
├── index.html                       总览页：两张卡片 → 两个子项目的 index.html
├── fourier_transform.html           旧地址跳转页 → ft_laplace/fourier_transform.html
├── laplace_transform.html           旧地址跳转页 → ft_laplace/laplace_transform.html
├── .nojekyll                        关闭 GitHub Pages 的 Jekyll 处理
├── README.md                        仓库级说明（入口表、本地运行、部署、版本历史）
├── ft_laplace/                      子项目一（原独立仓库）
└── fs_inv_ft_inv_laplace/           子项目二（原独立仓库）
```

两个跳转页是纯 HTML，用 `<meta http-equiv="refresh">` + `<link rel="canonical">` 把合并前的旧 Pages 地址（`/fourier_transform.html`、`/laplace_transform.html`）重定向到子目录里的新位置，保证已有书签与外链不失效。

### 子项目一 `ft_laplace/`

```
ft_laplace/
├── index.html                                        落地页（英文），两张卡片指向下面两页
├── fourier_transform.html                            傅里叶变换交互页（单文件，1024 行）
├── laplace_transform.html                            拉普拉斯变换交互页（单文件，2039 行）
├── Fourier Transform - A Visual Introduction.ipynb   主 Notebook（nbformat 4.2，Python 3.11.8 生成，19 个单元格）
├── README.md
└── AGENTS.md                                         该子项目的详细内部说明
```

特点：**每页都是一个自包含的单文件**，HTML/CSS/JS 全写在一起，没有模块划分，JS 全是全局函数。外部依赖只有 CDN 上的 mathjs 12.4.1（编译并数值求值用户输入的函数）与 KaTeX 0.16.9（auto-render 作用于整个 `document.body`，渲染全页 `$…$`/`$$…$$` 公式，不限于讲解节），主地址 jsdelivr、回退地址 cdnjs。

`fourier_transform.html` 的正文是「输入函数」面板 + 5 个编号小节（1 信号 → 2 缠绕网格 → 3 逐帧动画 → 4 质心曲线 → 5 几何意义静态讲解），`laplace_transform.html` 是「输入函数」面板 + 7 个编号小节（1 包络 → 2 s 平面缠绕 → 3 动画 → 4 s 平面 log10|F| 地图 → 5 极点和收敛域 → 6 三维螺旋 → 7 讲解）。

**该子项目的页面内部结构、每一节的算法与实现细节、若干"不要改回去"的约定（缠绕核角度符号、递推初值、求和缩放等）都写在 `ft_laplace/AGENTS.md` 里，改动这一目录前必须先读它。**

### 子项目二 `fs_inv_ft_inv_laplace/`

```
fs_inv_ft_inv_laplace/
├── index.html                                      枢纽页（四张卡片 + 本地运行说明）
├── Fourier_series_linear_superposition.html        ① 傅里叶级数线性叠加
├── From_Fourier_series_to_Fourier_transform.html   ② T→∞ 谱线变密、过渡为傅里叶积分
├── Fourier_inverse_transform_synthesis.html        ③ 傅里叶反变换合成
├── Laplace_inverse_transform_synthesis.html        ④ 拉普拉斯反变换合成
├── assets/common.css                               共享样式（页面布局 + 无障碍/错误条样式）
├── assets/common.js                                共享工具函数
├── assets/fsls.js  ift.js  bridge.js  laplace.js   四个页面各自的脚本
├── assets/expr.js                                  自定义 f(t) 的迷你表达式解析器（只被拉普拉斯页加载）
├── assets/tex.js                                   极简 TeX 子集渲染器（零依赖，五个页面都加载）；不是 KaTeX
├── tools/check.js                                  开发验证脚本（唯一的自动化测试）
├── LICENSE                                         MIT
└── README.md
```

模块划分与子项目一不同，是**「薄壳 HTML + 外链 JS」**：

- 四个页面 HTML 只有 110–153 行，只放结构（`<header>` 里的标题与公式、`<main>` 里的 `<canvas id="cv">`、`<aside>` 参数侧栏）与外链资源，不写脚本逻辑。
- 每页在 `</body>` 前依次加载 `<script src="assets/common.js">` 和 `<script src="assets/<页面>.js">`；`assets/tex.js`（页内公式排版，见下）被**枢纽页与全部四个可视化页**加载，`assets/expr.js`（自定义 f(t) 的解析器，零依赖、不 eval 用户字符串）只被拉普拉斯页加载。
- **公式用 TeX 写法、由 `assets/tex.js` 在本地排版**（**没有** KaTeX/MathJax，也没有 CDN —— 子项目二的"完全自包含、不依赖网络"不许破）。写法：把 TeX 放进元素文本里，`<span class="tex">\frac{1}{2\pi j}</span>` 或块级 `<div class="tex-block">…</div>`；`texify()` 在 DOMContentLoaded 时渲染，并给 `.tex-block` 自动补 `.tex` 类（CSS 只写一套 `.tex …` 规则）。支持 `\frac \sqrt \text`、`^ _`（`\sum/\prod/\lim/\max/\min` 的上下限竖排、`\int` 用右下角上下标）、常用希腊字母与算符、`\sin \cos \exp \log …`、`\,`/`\;`/`\quad`。**写不出来就会渲染成带 `.texerr` 的原样文本**（红色虚线框），`tools/check.js` 的探针会把它判成失败，所以别指望静默降级。若要真正的任意 TeX，得把 KaTeX 本地化进 `assets/`（约 0.5 MB，含字体）——目前刻意没做。
- 每个页面脚本是一个 IIFE（`(function(){ 'use strict'; ... })();`），全部状态集中在一个 `st`/`state` 对象里。
- 四个页面共用一套布局：上方复平面（首尾相接的旋转伸缩向量链）与频谱视图，下方时域视图，右侧 336px 侧栏放参数与开关。
- 两页的时域面板都在 **t=0** 处画了一条"原点线兼幅值轴"：拉普拉斯页是自己新加的（`#3d5680` 竖线 + 刻度 + `幅值 Re s(t)` / `t = 0（时间原点）` 两个标注），傅里叶反变换页原来就有绿虚线 + `t=0` 标签、这次补了幅值刻度（数字写在轴左侧）。**两页都必须画在曲线之后**：因果信号在 t=0 是跳变，理想/合成曲线会在这一列画出近乎垂直的线，先画就被盖住（拉普拉斯页与傅里叶页都已挪到 `strokeCurve` 之后）。竖线与刻度都做半像素对齐（`x0+0.5`），否则 1px 线被摊成两列 50% 的灰线。
- `laplace.js` 时域视图的纵轴**只按观测窗 ±Tw 定标**，窗外 `|t|>Tw` 的合成段用 `globalAlpha=0.18` 淡画（`drawTime()` 里的 `xa`/`xb` 软剪裁）。原因：σ≠0 时窗外的 `|Re s(t)|` 是被 e^{σt} 放大的 Ω 截断误差（默认 σ=0.5 时 t=36 处实测 1.4e4，而窗内峰值只有 0.94），一旦纳入定标，窗内（f(t) 真正成立处）会被压成一条直线 —— 表现为"链端点读数 0.5716、时域图上却是 0"这种读数与图形对不上的假故障（2026-09 已修，`tools/check.js` 的 `winLift` 判据守着它）。**不要改回"全轴取最大"。**
- `laplace.js` 的观测窗 ±Tw = `st.winMul × P().tail(st.p)`（默认 1，滑条 0.3…3，`twNow()`）。Tw 同时决定误差读数、纵轴定标、横轴半宽 `Xw = clamp(Tr+Tw, 3Tw, 6Tw)`（`xwNow()`）与播放回绕范围，改 Tw 的口径要连带看这几处；`tools/check.js` 断言 `winMul` 确实穿过 Tw 与 Xw。
- **复平面量程冻结 + 比例尺**（两页各一套，函数同名：`computeScale()`/`chainExtentOf()`/`niceScaleNum()`，采样 `K=20`（21 点、**必须取偶数**：K=9 的 10 个点正好跳过 t=0，窗内最大幅度被低估 3.4 倍、t≈0 时链冲出面板被剪掉，2026-09 修；check.js 有"冻结量程 ≥ 窗内最大幅度"的判据守着），勾选框 `#ckFreeze`，`st.freezeScale`）：勾选时量程取「观测窗 ±Tw 内整条链伸得最远」的幅度 ×1.15、**播放/拖动 t 时不重算**（`mainMx`；`0` 是"自适应"的哨兵），端点大小就能跨 t 比较；左下角**始终**有一条 `|s| = …（比例尺）`，所以量程怎么变都能读绝对值。原来每帧按当前链取最大，链永远刚好铺满面板，出现"Re s(t)=0.96 与 0.03 画出来差不多长"的假象（2026-09 修）。**默认值两页一致：都勾上**（2026-09 按用户要求统一；同一组参数下两页画出来一样大，实测 t=0/8/16 处占比 87%/3.8%/1.8% 对 87%/3.7%/1.7%）。σ=0 的傅里叶页里链幅度的起伏来自相位相消而不是 e^{σt}，实测窗内就差 34%（rect）～99%（sexp、dexp），所以 t 离开 0 之后链缩得很小——那是真实幅度，不是画错；想随时看清链就取消勾选退回每帧自适应。**改这一块时注意三点**：① 冻结后链会超出量程，`drawComplex()` 里必须保留 `ctx.rect(...).clip()`；② `tools/check.js` 用 `drawSc()`（上次 `draw()` 真正用掉的缩放）断言"冻结时 sc 与 t 无关 + 端箭头长 ∝ |s(t)|"，只读 `mxRef()` 抓不到画法被改回去（已实测）；③ 比例尺的像素计数 `barPx` 也进了像素扫描。
- 端点箭头分三档（两页同款；`drawComplex()` 里 `eLen`，导出为 `arrowInfo()` → `{px, stub}`）：>3px 画实长箭头；(1e-3, 3] px 改画**虚线示意箭头**（固定 12px、按真实方向、`globalAlpha=0.55`）并在旁边标 `≈0（箭头示意，已放大 N×）`；≤1e-3 px（值已打印成 0.0000）就不给方向、只写一行 `≈0（|s(t)| 小到画不出方向）`。check.js 三档都断言（第三档靠"全部静音"造出 s(t)≡0）。**别把中间档删掉退回"干脆不画"**——那会让人误以为没有向量。
- **自定义 f(t)（B 路线，2026-09 加）**：`expr.js` 的 `parseExpr(src)` 把迷你表达式编译成数值函数（变量只有 `t/a/w0`，白名单函数常量，隐式乘法、`**`、`\sin`/`e^{-2t}`/`{}[]` 这类 LaTeX 味写法都收下），`laplace.js` 里 `CUS` 对象负责数值路线：`cusBuild()` 粗探针 ±60 s → 观测窗 Tw 与 ROC 估计；`cusSpectrum()` 粗扫 |X| → 主频 `peak`（定取景半宽 `imr`、并给 `lobe` 兜底）；`cusWeights()` 在加权跨度上中点求积 → 权重表与灰幕布。`numX()` 被 `cusQuad()` 复用（`Xof`/`refIntegral` 走它）。三条必须记住的约定：① `cusSum()` 的初始相位是 `e^{-jωt₁}`、步进 `e^{-jωh}`（符号错了会得到频率相关的相位误差，check.js 抓这个）；② 求积步长 `h ≤ 0.25/ωmax`，且采样点封顶 4096，支撑不了的 ω 由 `CUS.wLim` 反过来砍 N；③ 自定义信号没有闭式解，所以 **ROC 是估计值、极点/零点不画**，`P().lobe` 仍按预设口径 `2(σ+1/尾巴)` 推（对 `exp(-t)u(t)` 恰好给出与 sexp 预设一致的 lobe=3、Ωmax=24）。
- 右上频谱视图有两处可选/固定的三维化，用同一套等距投影与交互（面板内按住拖动改 `st.yaw`/`st.pitch`，`Shift+方向键` 亦可；双击面板恢复全部被静音分量）：`ift.js` 勾选「3D 频谱栅栏」后栅栏站在 σ=0 上、颜色 = t=0 初相位；`laplace.js` 的右上**恒为** 3D s 平面（水平面 = s 平面，柱高 = 权重 `|X(σ+jnΔω)|·Δω/2π`，颜色 = 相位 `arg X`，随 σ 滑条沿 σ 滑动，地板上画 ROC 绿带与极点/零点）。两页的柱体都用索引式屏幕空间拾取做悬停高亮。**复平面向量链与栅栏/频谱同色**：都按 `phaseBucket(n)`（＝该分量 `arg X(σ+jnΔω)` 分 24 桶）取 `colFor`，所以悬停某根柱子时链上对应段不仅是白色加粗、颜色本来也对得上（2026-09 按用户要求把拉普拉斯页从 `bucketOf` 索引配色统一过来）。链段的绘制循环现在从 `i=0` 起（`i` 段 = 分量 `v_{i−N}`，`i=0` 那段从原点出发），补上了原先漏画的 `v_{−N}`；`lastChain.buckets`（导出 `chainBuckets()`）记录每段的桶号，check.js 用它断言"链段配色 = 相位桶"，防止被改回索引配色。

`assets/common.js` 以全局函数形式暴露共享工具（四个页面的 IIFE 直接引用），勿改成模块或改名：

| 函数 | 用途 |
| --- | --- |
| `colFor(k)` | 把分量索引映射成统一配色 `hsl(...)` |
| `fmt(v, d)` / `fmtG(val)` | 定点格式化 / 带 k、∞ 的紧凑格式化 |
| `bucketOf(n, N)` | 把分量下标归到 24 个色桶 |
| `clamp(v, lo, hi)` | 数值夹取 |
| `attachPointer(cv, handlers)` | 用 Pointer Events 绑定 `{down, move, up}`，down 后尝试 `setPointerCapture`，触屏/手写笔可用 |
| `installErrorBanner()` | 插入 `#errbar` 红条并监听 `error` / `unhandledrejection`，避免"打开空白却无提示" |

**测试钩子约定（改了会直接弄坏 `tools/check.js`）**：四个页面脚本末尾都会把状态与控制函数挂到全局，供无头探针与桩 DOM 使用；

- 四个页面统一有 `globalThis.__VIZ = { st, draw, apply }`；
- 另有更细的数学接口：`ift.js` → `__IFT`，`bridge.js` → `__FT`，`laplace.js` → `__LIT`（`fsls.js` 只有 `__VIZ`）。其中 `__IFT`/`__LIT` 还各带 3D 视图的钩子：`proj3(w,σ,h)` 用最近一次 `draw()` 的视角投影、`view3()` 返回该视角（`__LIT` 另有 `rects()` 返回画布分栏矩形、`phaseFrac(n)`/`phaseBucket(n)` 相位分色、`pickBar(x,y)` 屏幕空间拾取、`twNow()`/`trNow()` 观测窗与黎曼周期、`cus()` 返回自定义信号状态 `{src,f,err,hint,warn,tail,rocLo,rocHi,lobe,imr,peak,wLim,...}`、`cusQuad(σ,ω)` 单点数值 X、`cusWeights(N,Δω,k)` 权重表）。`laplace.js` 的 `apply()` 也接受 `winMul`、`w0`、`fstr`（自定义表达式）三个字段。
- `assets/expr.js` 暴露全局 `parseExpr(src)` → `{ok, err, src, used, at(t, env)}`；`assets/tex.js` 暴露 `renderTex(src)`（TeX→HTML 字符串）与 `texify(root)`（把页面里 `.tex/.tex-block` 渲染掉）。两者与页面脚本不是同一套 IIFE 约定，勿改名。

## 构建与运行

没有构建步骤。

**浏览站点**

- 直接双击根目录 `index.html`：卡片链接都指向具体的 `index.html`，在 `file://` 下也能一层层点进去；
- 或在本目录启动静态服务器：`python -m http.server`，访问 `http://localhost:8000/`。

子项目二 **完全自包含、不依赖网络**；子项目一的两个页面需要联网加载 mathjs/KaTeX CDN，加载失败时页面约 8 秒后给出提示，不降级。

**跑 Notebook**

```bash
pip3 install --user numpy matplotlib seaborn ipywidgets ipympl
jupyter notebook "Fourier Transform - A Visual Introduction.ipynb"
```

第 3 节的动画单元格依赖 `%matplotlib widget`（ipympl）。notebook 内嵌大量 base64 图像输出、文件很大（约 111 KB），**直接手工编辑 JSON 极易出错，应尽量用 Jupyter 界面编辑**。

## 工具链取舍（为什么不引入构建 / 后端 / 测试框架）

外部流传的「独立开发者穷鬼套餐」类清单（GitHub Free、Cloudflare Pages/Workers/D1、Supabase、Upstash、Turnstile、PostHog、Playwright、Vitest、Lighthouse、ZAP、Trivy、Penpot、GIMP、Notion…… 6 类约 47 个工具）隐含的假设是**做一个有后端、有账号、有表单、有数据库的全栈产品**。本仓库是零构建的纯静态教学站，重叠面极小。下面的结论已逐项对照代码核实过，**再看到同类清单先查这一节，不要照着装**。

**真正用得上**

- **GitHub Free**：已在用，Pages = `main` / `/ (root)`（见「部署」）。
- **Lighthouse**：最值得补的一个。Chrome DevTools 内置、零安装、不产生 `package.json`，正好用来量化本仓库把无障碍/性能写成硬约定这件事。用法与已知误报见下一节「无障碍与性能体检」。
- **VS Code**（或任意编辑器）：非硬需求，本仓库没有需要 IDE 支持的构建或类型系统。

**可选，但有前置条件**

- **Excalidraw / Inkscape**：只在为 `README.md` 或根 `index.html` 卡片画示意图时才需要，产物要作为文件提交。
- **Lucide 图标**：**必须把 SVG 内联进 HTML**，不得引图标 CDN 或图标字体——那会破坏子项目二「完全自包含、不依赖网络」这条既有事实。
- **Gitleaks CLI**：廉价保险。仓库本就不含密钥（见「安全注意事项」）。
- **PostHog**：只在确实想要访问统计时才考虑；代价是引入第三方脚本、产生隐私告知义务，并同样破坏子项目二的零网络依赖。

**明确用不上（及原因）**

| 工具 | 为什么不需要 |
| --- | --- |
| Cloudflare Workers / D1 / Supabase / Upstash Redis / Turnstile | 没有后端、没有数据库、没有表单、没有账号体系、没有人机验证场景 |
| Cloudflare Pages | GitHub Pages 已跑通且全站相对路径；「每月 500 次构建」对本项目是 **0 次构建** |
| Playwright / Vitest | 与 `fs_inv_ft_inv_laplace/tools/check.js` 的无头 DOM 探针 + 自解 PNG 像素扫描**功能重叠**，且两者都要 `npm install`，会打破「全仓库无 `package.json`」这条事实。真要引入，必须同时改掉本文件与 README 里的相关表述 |
| Trivy | 没有依赖清单可扫。第三方代码只有手写在 HTML 里的两个 CDN 版本号（mathjs 12.4.1、KaTeX 0.16.9） |
| ZAP | 没有服务端。唯一的安全点是 `math.compile()` 执行访客输入的表达式，属设计意图且只在访客自己的浏览器内运行，已记录在「安全注意事项」 |
| Wireshark / Apache JMeter | `curl` 或 DevTools 足够；对 GitHub Pages 的 CDN 做压测没有意义 |
| SQLite / DBeaver / Hoppscotch | 没有数据库、没有接口 |
| Google Fonts | 新增一个网络依赖 + 字体闪烁（FOUT），与子项目二离线可用相冲突。三个页面的字体栈本来就全是系统字体（`--serif` / `--sans` / `--mono`，见 `ft_laplace/fourier_transform.html:27-29`） |
| GIMP / Krita / Blender / Penpot | 视觉全部在代码里：3D 螺旋与 3D s 平面都是 Canvas 逐帧算出来的，没有位图素材管线 |
| Tally / Cal.com / Notion / Trello / Bitwarden / Obsidian / LibreOffice / Joplin | 个人工作流工具。文档已经在仓库内（两份 `AGENTS.md` + 三份 `README.md`），搬去 Notion 只会制造两份互相过期的真相 |
| 低价进阶全部（Carrd / GitHub Team / Workers Paid / Railway） | Carrd 与「手写可视化教学页」的目的相反；单人仓库不需要 Team；没有后端可扩容 |

**清单里没有、但本项目真正需要的**

- **Node.js + 本机 Chrome/Chromium**：`tools/check.js` 的硬依赖（只用 Node 内置模块，无 npm 依赖）。Chrome 路径可用 `CHROME` 环境变量覆盖，Edge 也可以。
- **Python 3 + Jupyter**：跑 `ft_laplace/Fourier Transform - A Visual Introduction.ipynb`，需要 `numpy matplotlib seaborn ipywidgets ipympl`；第 3 节动画依赖 `%matplotlib widget`（ipympl）。
- **Git + 一个能连通 github.com 的代理**：见「版本控制与仓库历史」里的本机环境说明。

**一句话结论**：日常只加 **Lighthouse**（配合 `node fs_inv_ft_inv_laplace/tools/check.js`）。凡是需要 `npm install` 的一律不引入，除非同时改掉本文件「零构建、全仓库无 `package.json`」这条事实。

## 测试与验证

### 子项目二：`tools/check.js`（唯一的自动化测试）

```bash
node fs_inv_ft_inv_laplace/tools/check.js            # 全部四个页面
node fs_inv_ft_inv_laplace/tools/check.js ift fsls   # 只跑指定页面（key ∈ ift | fsls | bridge | laplace）
```

需要 Node.js 与本机 Chrome/Chromium（仅用 Node 内置模块，**没有 npm 依赖**）。Chrome 路径可用环境变量 `CHROME` 覆盖，脚本默认按常见安装路径探测（Windows / Linux 都覆盖，找到 Edge 也可用）。任何一项失败，进程退出码为 1。

脚本分这些步：

- **步骤 A 语法**：对四个页面的 `assets/*.js`、`assets/common.js`、`assets/expr.js`、`assets/tex.js` 逐个执行 `node --check`。
- **步骤 B0b `tex.js` 渲染器**：16 条渲染用例（分式/根号/上下标/`\sum`、`\lim` 的竖排上下限/`\int` 的右下角上下限/希腊字母/关系与二元算符间距/`	ext`/`\left
ight`/转义花括号/负号用 U+2212）+ 5 条必须回退成 `.texerr` 的坏输入（未知命令、花括号不闭合、多余右括号、`e^{`、`\sqrt` 缺参数）。
- **步骤 B0 `expr.js` 解析器**：31 条语法/求值用例（隐式乘法 `2t`、`**`、`e^{-a*t}`/`\sin(\pi t)` 这类 LaTeX 味写法、`u(t)`/`heaviside(t)`、右结合幂、`1e-3`、`ω0` 别名…）+ 一批必须报错的输入（空、括号不闭合、未知函数/符号、参数个数错、超长），以及 `used` 记录、别名归一、超长拒绝。
- **步骤 B 桩 DOM + 数学断言**（ift 与 laplace）：用 `new Function(...)` 在自制的桩 `window`/`document` 里加载 `common.js` + 页面脚本（laplace 连 `expr.js` 一起加载），取出 `window.__IFT` 或 `window.__LIT`。ift：断言黎曼和的数学性质——分量数 `N`、`chainAt(0).end[0]`、时域曲线与解析式 `sExact` 的最大偏差（阈值 `1e-12`）、`phaseFrac` 相位分数、`regime` 判定档位；再切到 `sexp` 预设重算一遍；另外断言复平面量程冻结（`drawSc()` 在 t=0 与 t=5 上相同、端箭头长 ∝ |s(t)|；不勾时 `mxRef()=0` 且 `drawSc()` 随链幅度变）与端点 ≈0 的三档画法（含"全静音 → 不给方向"）。期望值写在文件顶部的 `IFT_EXPECT` 常量里。laplace：断言权重 `= X(σ+jnΔω)·Δω/2π`、实信号相位分色奇对称（`phaseFrac(-N)+phaseFrac(N)=1`）、`chainAt(0).end` 落在 Bromwich 值附近、`regime` 档位，并在 `draw()` 之后用 `proj3`/`view3`/`rects` 检查 3D 面板的投影几何——地板四角与高度轴顶端都落在 `R.spec` 内、栅栏柱竖直向上生长、改 `yaw` 后远端投影明显移动；另外断言观测窗倍数 `winMul` 同时穿过 `Tw` 与 `Xw=clamp(Tr+Tw,3Tw,6Tw)`，**复平面量程冻结**（`drawSc()` 在 t=0 与 t=3 上完全相同、端箭头长之比 = |s(t)| 之比；取消冻结后 `mxRef()=0` 且 `drawSc()` 随链幅度变），以及自定义信号的数值路线：`cusQuad()` 与闭式解 `1/(s+1)`、`2a/(a²−s²)` 的相对误差 < 1.5%、数值权重 = X·Δω/2π（相对 1e-4，含虚部符号）、`Tw`/`ROC` 估计与 sexp/gauss 预设同口径、非法表达式报英文错但保留上一个可用信号。期望值写在 `LIT_EXPECT` 常量里。
- **步骤 C 无头探针**：给每个页面 HTML 尾部注入一段探针脚本（写进临时文件再删），用 `chrome --headless=new --dump-dom` 打开并检查：画布有布局且 ≥ 400×300、错误横幅未亮起、探针未抛错、存在 `__VIZ` 句柄、`draw()` 能重跑；另外统计 TeX 公式（`tex=`/`undone=`/`texErr=`/`fracBad=`）——有没渲染完的、有 `.texerr`、或分式没上下叠放的都算失败。**探针挂在 `load` 上而不是立即执行**：`tex.js` 在 DOMContentLoaded 才排版，立即跑会量到未排版的布局（画布位置差 100+ px，像素扫描全错位）。探针里附了一条 `<style>.stage{flex:none;width:1242px;height:730px}</style>` 钉住画布尺寸——`--dump-dom` 与 `--screenshot` 两次运行的视口并不相同（1600×900 vs 1578×802），不钉住截图里的画布会被横向拉伸（1242→1264），像素扫描坐标就对不上了。
- **步骤 C2 自定义信号真渲染**（仅 laplace）：再注入一段探针，切到 `custom` 预设（`exp(-a*t)*sin(w0*t)*u(t)`、a=1、ω0=2、σ=0.5），在页面内用 `getImageData` 量时域观测窗内离轴 ≥20px 的亮青像素 `lift`，判据 `lift > 80`（实测 263）：确认数值求积出来的 X 真的画得出有高度的曲线。
- **步骤 D 像素扫描**（ift 与 laplace）：用无头 Chrome 截图，自己解 PNG（`zlib.inflateSync` + 反滤波），在画布矩形的特定区域统计颜色像素数。ift：确认时域曲线、频谱谱线、轴标签确实画出来了，另数复平面左下角比例尺的像素 `barPx`（≥20）。laplace：确认 3D s 面板里确实画出了相位分色的栅栏柱（含落在面板上半部、即地板平面之上者）、ROC 绿带与极点标记；另确认**时域面板观测窗 `|t|≤Tw` 内离轴 ≥20px 的亮青像素** `winLift` 不为零（即窗内合成曲线确实有高度，而不是被窗外截断误差压到轴上），以及**复平面左下角比例尺**的像素 `barPx`（量程冻结后"能读绝对值"就靠那条尺）；判据是 `sat`/`satUpper`/`gband`/`winLift`/`barPx` 五个计数的下限。阈值分别写在文件顶部的 `PIXEL` 与 `LIT_PIXEL` 常量里。

**因此：改动 `ift.js`/`laplace.js`/`expr.js`/`tex.js` 的数学实现、配色、3D 视距、时域纵轴定标、数值 X 的口径或公式排版 CSS 时会触发步骤 B/B0/B0b/C/C2/D 失败，此时应同步更新 `IFT_EXPECT`/`PIXEL`/`LIT_EXPECT`/`LIT_PIXEL`/`EXPR_CASES`/`TEX_CASES`/`TEX_BAD`/`CUSTOM_LIFT_MIN` 常量（如果改动是有意的）。新增页面时，把页面加进 `PAGES` 数组并在 HTML 里保留 `#cv`、`#errbar`、`__VIZ` 三项约定。**

实测（本机 Node v24.18.0 + Chrome，2026-09 运行）：18 项全部通过，`ALL CHECKS PASSED (18 items)`。

脚本会在子项目根目录写入 `_probe_*.html`、`_probe_custom.html`、`_shot_*.html` 临时文件，正常路径下自行删除，异常中断可能残留，已在 `.gitignore` 中排除。

### 子项目一：无自动化测试

`ft_laplace/` 没有测试脚本、没有 CI，验证全靠人工：浏览器打开两个页面确认各节渲染与动画/滑块交互正常；notebook 按顺序执行单元格，确认四节图形与第 3 节动画正常。

notebook 每次重跑都会产生 `execution_count`、widget `model_id`、内嵌 base64 图像等大量 diff，这是正常现象，不代表代码出错，提交时通常一并带上。

## 无障碍与性能体检（`ft_laplace/` 两页，2026-09）

**先说适用范围**：下一节「代码风格与开发约定」里那条无障碍/性能约定（`prefers-reduced-motion`、canvas `role="img"` + `aria-label` + `tabindex`、`devicePixelRatio` 夹到 2、隐藏标签页暂停绘制）**目前只在子项目二成立**。`ft_laplace/` 的两页是 2019 年原仓库直接搬进来的，从未按这套约定改造过。**本节只记录现状，做这轮核对时没有改动任何页面代码。**

下文 `fourier` = `ft_laplace/fourier_transform.html`，`laplace` = `ft_laplace/laplace_transform.html`。

### 与子项目二约定的逐条对照

| 约定 | 子项目二 | `ft_laplace/` 两页 |
| --- | --- | --- |
| canvas `role="img"` + `aria-label` + `tabindex` | ✅ 四页全有 | ❌ **14 个 canvas 全部没有**（`fourier:258,266,282,290,291,292`；`laplace:310,324,346,353,357,358,372,379`）。页面全部实际内容都画在 canvas 里，因此对读屏软件完全不可见；axe 的 `canvas`（缺回退文本）规则会报 |
| `devicePixelRatio`（上限夹到 2） | ✅ | ❌ 全目录搜不到 `devicePixelRatio`；改用固定 `width`/`height` 属性 + `canvas{display:block;max-width:100%}`（`fourier:142`、`laplace:163`）。**已实测**：加 `--force-device-scale-factor=1.5` 后 14 个 canvas 的「位图像素 / CSS 像素」全部仍是 1，即 `upscaled=true`（dpr=1 时只有 `canvasSliceA/B` 两个是 true）。后果：Windows 125%–150% 缩放或窄窗口下位图被合成器重采样，图内文字发虚 |
| `visibilitychange` 暂停绘制 | ✅ | ❌ 搜不到 |
| `prefers-reduced-motion` | ✅ 含 JS 默认暂停 | ⚠️ 只有 CSS 层（`fourier:207-210`、`laplace:232-235`、`ft_laplace/index.html:83`）。**但严重度低**：两页零处 `requestAnimationFrame`，`animPlaying` 初值为 `false`（`fourier:469`、`laplace:606`），`animStep()` 只由 Play 按钮的 `togglePlay()` 启动（`fourier:773`、`laplace:1189`）——**没有自动播放的动画**，所以 CSS 那条已覆盖全部自动动效（`scroll-behavior:smooth` 与 transition/animation） |
| 键盘操作 | ✅ 含 `Shift+方向键` | ❌ `laplace` §6 的 3D 螺旋只能鼠标拖动（`drawSpiral` / `projectPoint`，手写正交投影），canvas 又不可聚焦 |

### 确定要修的问题（按严重度）

1. **两个 range 没有可访问名**（axe `label`，serious）——**实测确认**。headless 下 `fourier` 报出 2 个无可访问名控件：`input#animFreq`（`:275`）与 `input#animFrame`（`:279`），原因是它们前面的 `<label>Freq #</label>`（`:274`）与 `<label>Frame</label>`（`:278`）既没有 `for`、也没有包裹控件。`laplace` 实测为 **0 个**——同功能的 `Frame` label 写了 `for="animFrame"`（`:342`）。`fourier` 其它 label 也都是对的（`for="funcInput"` `:230`、`tMin`/`tMax` `:234,238`、`freqMin`/`freqMax` `:242,246`）——**只漏这两个**。
2. **标题跳级**（axe `heading-order`）——**实测确认**。实测标题计数：`fourier` = `{h1:1, h2:6, h4:7}`、`laplace` = `{h1:1, h2:8, h4:9}`，**两页零 `h3`**，各报 1 处跳级（`fourier`：`h2→h4 @ h4 "Sampling the signal"`；`laplace`：`h2→h4 @ h4 "The definition"`）。位置：`h1`（`fourier:215` / `laplace:240`）→ `h2`（`fourier:227,255,262,270,286,297` / `laplace:248,302,320,329,350,368,376,388`）→ **直接跳到 `h4`**（`fourier:312,322,332,355,376,385,419`；`laplace:406,416,437,448,472,480,506,531,546`）。
3. **radio 焦点不可见**（WCAG 2.4.7）——**⚠️ 仍是静态推断，本轮实测未能验证**（探针的焦点规则扫描有缺陷，返回假阴性，见下文「headless 实测」；不要在没修探针前把这条当成已证实）。依据：`.input-panel input:focus{outline:none;border-color:var(--accent)}`（`fourier:107-108`、`laplace:102-103`）命中了 `.input-panel` 里的两个 radio（`laplace:257,258`），而 `.radio-group input[type="radio"]`（`laplace:154`）只设了 `accent-color` 和尺寸、没有任何焦点样式 → 键盘走到时**完全看不到焦点**。文本/数字输入至少还有边框变色（`--hairline` 合成后约 `#2d3751` → `#4cc9f0`，8.27:1），勉强算可见。range 滑块全部在 `.anim-controls` 里（`fourier:273` 包 `:275,279`；`laplace:305` 包 `:307`、`:332` 包 `:334`、`:337` 包 `:339,343`），不在 `.input-panel` 内，也没有自定义 `-webkit-slider-thumb`（全目录零匹配）→ 保留 UA 默认焦点环 ✅；按钮由 `.btn:focus-visible, .anim-controls button:focus-visible`（`fourier:131` / `laplace:125`）给 2px 环 ✅；`.btn-preset` 未被抑制，保留默认环 ✅。
4. **小字标签对比度不达标**（axe `color-contrast`，serious）——**实测确认**，而且是两页**唯一**的 fail 签名：`#7b87a6` 压 `#16213e` = **4.43:1**（需 4.5:1，差 0.07），实测字号 **11.2px / w400**，样本 `"Function f(t) ="`，命中数 `fourier` **7 处**、`laplace` **12 处**——即两页**每一个控件的字段名**。来源是 `.input-panel label`（`fourier:100` / `laplace:95`）与 `.anim-controls label`（`fourier:152` / `laplace:173`）都用 `--text-faint`、`0.7rem`，容器背景是 `--surface`。**同时修正一条早先的静态推断**：我原本写「同一个 `--text-faint` 用在 `.note`（CSS 定义 `fourier:129` / `laplace:123`）与 `.loading`（`fourier:172` / `laplace:201`）上却是过的（4.76:1）」——**实测是 inconclusive，不是 pass**：这些元素在面板外，背景落在 `body` 顶部的 radial-gradient 上，取不到单一底色；`.loading` 还是 `display:none`，根本没被测到。准确说法是「面板内 fail、面板外无法判定」，改配色时按最坏情况处理。
5. **`.btn-danger` 是死 CSS，不构成现存缺陷**——**实测推翻早先的静态推断**。`.btn-danger`（`background:linear-gradient(180deg,#ff64ad,var(--accent2));color:#fff`）**只在 `fourier:128` 定义，`laplace` 连这条规则都没有**，而且三个 variant、两页的实测类名计数 `btn-danger` **全为 0**——页面上没有任何元素在用它。手算的 `#fff`/`#ff64ad` = 2.73:1、`#fff`/`#f72585` = 3.78:1 确实都低于 4.5，但当前不命中任何真实元素，属于「将来启用这个类就会踩」的潜在坑。**口径提醒**：axe / Lighthouse 对 `linear-gradient` 背景通常判 inconclusive 并跳过，不会直接 fail。（对照 `.btn-primary` 的 `#04121c` 压 `#74daf9→#4cc9f0` 渐变 = 9.85:1，没问题；实测 `btn-primary` 两页各 1 个、`play-btn` 各 1 个、`btn-preset` fourier 0 / laplace 3、`radio-group` fourier 0 / laplace 1。）
6. **CDN 失败提示没有 live region**——**实测确认**（用死代理 `--proxy-server=http://127.0.0.1:9` 逼 CDN 失败，配合 `--virtual-time-budget=20000` 让页面自己的 8 秒计时器在 `--dump-dom` 下真的触发）。两页实测结果一致：`btnText="math.js failed to load — check network"`、`btnDisabled=true`、`loadingVisible=true`、`loadingText="⚠️ Failed to load math.js. Please check your internet connection and refresh."`，而 `btnLive=null`、`loadingLive=null`，全页 `aria-live`/`role=alert`/`role=status` 计数**实测 = 0** → 读屏用户收不到任何提示，表现为「一个点不动的按钮 + 静默死路」。计时器在 `fourier:997-1003`、`laplace:2012-2018`。另一条路径 `alert('math.js is still loading. Please wait a moment and try again.')`（`fourier:559` / `laplace:825`）是原生对话框，会被播报 ✅。CDN 回退机制本身没问题：`fourier:8,12,14` / `laplace:8,12,14` 的 `onerror="this.onerror=null;this.src='https://cdnjs.cloudflare.com/...'"`（mathjs 12.4.1、KaTeX 0.16.9、auto-render）。

### 结构性缺失（改动较大，先知道）

- **零 landmark**：两页没有 `<header>` / `<nav>` / `<main>` / `<aside>`，没有任何 `role=` 属性（整个 `ft_laplace/` 只有 `index.html:120` 一个 `<footer>`）；也没有 skip link、没有 `.sr-only`。
- **`<label>` 被当读数框用**：`fourier:276`（`#animFreqLabel`）、`:280`（`#animFrameLabel`）、`laplace:308`（`#envReadout`）、`:335`（`#animSigmaLabel`）、`:340`（`#animOmegaLabel`）、`:344`（`#animFrameLabel`）；拖动滑块时读数变化不会播报（同样因为全站无 `aria-live`）。**实测确认**：孤立 label（既无 `for` 也不包裹控件）计数 `fourier` 4 个（`Freq #`、`#animFreqLabel`、`Frame`、`#animFrameLabel`）、`laplace` 5 个（`Integration range`、`#envReadout`、`#animSigmaLabel`、`#animOmegaLabel`、`#animFrameLabel`）；其余 label 全部 `resolvesToControl=true`。**已逐行确认**：`laplace:255` 的 `<label>Integration range</label>` 是一个**没有 `for`、也不包裹控件**的分组标题——两个 radio 在兄弟节点 `<div class="radio-group">`（`:256`）里，各自有自己的包裹 label（`:257,258`，实测 `wrapsControl=true` ✅ 有可访问名），缺的是分组本身的 `role="radiogroup"` + `aria-labelledby`。
- **播放按钮的可访问名是一个符号**——**实测确认**：两页各报出 1 个「名字是纯符号」的控件，都是 `button#animPlayBtn`，可访问名实测为 `▶`（读屏念不出含义）。`fourier:277`、`laplace:341` 都是 `<button class="play-btn" id="animPlayBtn" onclick="togglePlay()">▶</button>`；`togglePlay()` 切换 `▶` / `⏸` 文本时（`fourier:776,780`、`laplace:1192,1196`）没有同步 `aria-label` / `aria-pressed`。
- **`<img>` 缺显式尺寸**——**实测确认**：`fourier:430-431` 的 `b0ef0ca70073a40eba9fcd213d1a1b5b.jpg` 实测 `hasWidthAttr=false`、`hasHeightAttr=false`（`loaded=true`、`naturalWidth=1668`），`alt="Geometric meaning of the Fourier transform"` 正确 ✅ → Lighthouse 的「图片有显式宽高」（影响 CLS）会报。`laplace` 实测 0 张 `<img>`。

### 已核对为通过的项

三个页面都有 `meta charset="UTF-8"` 和非空 `<title>`；viewport 均为 `width=device-width, initial-scale=1.0`，**没有** `user-scalable=no` / `maximum-scale`（不阻断缩放）；`laplace:257,258` 的两个 radio 各自被 label 包裹；**没有引入 Google Fonts**——`--serif` / `--sans` / `--mono` 全是系统字体栈（`fourier:27-29`、`laplace:27-29`、`ft_laplace/index.html:18-20`）。

**手算的 WCAG 2.x 对比度**（用 Node 按相对亮度公式算，不是工具输出，可直接引用）：`--text #e0e0e0` 对 `--bg` = 12.92、对 `--surface` = 12.04；`#section5 p` / `#section7 p` 的 `#dee5f4` 对 `--surface` = 12.58；`h2 #eaf2ff` 对 `--bg` = 15.14、对 `--surface` = 14.11；`#ffffff` 对 `--surface` = 15.89；`--accent #4cc9f0` 对 `--surface` = 8.27；`--text-dim #99a5c2` 对 `--surface` = 6.45（`.radio-group label` 用的是它，✅）；`#04121c` 对 `#4cc9f0` = 9.85；`--text-faint #7b87a6` 对 `--bg` = **4.76（AA 勉强过）**、对 `--surface` = **4.43（不达标）**；`#fff` 对 `#ff64ad` = **2.73**、对 `#f72585` = **3.78**；`--hairline`（`rgba(255,255,255,.10)`）合成在 `--surface` 上 = `#2d3751`。

调色板：`--bg #1a1a2e` / `--surface #16213e` / `--text #e0e0e0` / `--text-dim #99a5c2` / `--text-faint #7b87a6` / `--accent #4cc9f0` / `--accent2 #f72585` / `--border #2a2a4a` / `--hairline rgba(255,255,255,.10)`，三页 `:root` 一致（`fourier:16-30`、`laplace:16-30`、`ft_laplace/index.html:8-21`，index 无 `--border`）。容器背景：`.input-panel` = `--surface`（`fourier:93` / `laplace:88`）、`.canvas-box` = `--surface`（`fourier:137` / `laplace:158`）、`.anim-controls` 无背景且位于 `.canvas-box` 内、`#section5`（`fourier:298`）与 `#section7`（`laplace:389`）本身就是 `<div class="canvas-box" id="sectionN">`、`body{background-color:var(--bg)}` 之上叠了一层顶部 radial-gradient（`fourier:35-38` / `laplace:35-38` / `index:24-27`）。

### `<html lang>` 与 Lighthouse 的已知误报

`fourier:2` 原来是 2019 年留下的 `lang="zh-CN"`（内容全英文，读屏会用中文语音念英文），**2026-09-22 已改为 `en`**；`laplace:2` 与 `ft_laplace/index.html:2` 本来就是 `en`。两页的 lang 现在都与内容一致，Lighthouse / axe 不应再报相关条目。

### headless 实测（2026-09-19）

上面的静态核对已用**无头 Chrome + 手写探针**实际跑过一遍（3 个变体 × 2 个页面 = 6 次运行，6/6 成功），下面是配方、实测数据和踩到的坑。

**环境**：本机 Chrome（`C:/Program Files/Google/Chrome/Application/` 下 `152.0.7977.84` 与 `153.0.8010.52` 并存；`chrome.exe --version` 取不到版本号，别再浪费时间试）+ Node v24.18.0，**零 npm 依赖**（与 `tools/check.js` 同一约束）。所有中间文件写在仓库外的 temp 目录，跑完 `unlinkSync` 删除，仓库内不留痕。

**配方**：读源 HTML → 在 `<head>` 之后插入 `<base href="file:///D:/.../ft_laplace/">`（否则 temp 副本里的相对 `<img>` 解析不到；插了之后实测 `naturalWidth=1668`）→ 在 `</body>` 之前插入 `<script>setTimeout(function(){ …PROBE… },9500)</script>` → 写成 temp `_audit_<variant>_<key>.html` → `chrome --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --window-size=1600,1000 --hide-scrollbars --virtual-time-budget=20000 <variant 额外参数> --dump-dom <url>` → 用 `/###AUDIT###([\s\S]*?)###END###/g` 取**最后一个**匹配 → 存 JSON → 删临时 HTML。实测视口是 `1578×902`（`--window-size=1600,1000` 会分别差 22px / 98px，做像素判定时要按实测值算）。

**三个变体的用意**：`base`（无额外参数，验 CDN 通时的正常状态）、`dpr15`（`--force-device-scale-factor=1.5`，验 canvas 位图密度）、`offline`（`--proxy-server=http://127.0.0.1:9` 指向死代理，逼 CDN 加载失败以验证 8 秒失败提示路径）。

**两个必须记住的坑**：

1. `--virtual-time-budget=20000` 是让页面自己的 `setTimeout(...,8000)` 在 `--dump-dom` 下**真的触发**的关键；探针因此挂在虚拟时间 9500ms。不加这个参数，CDN 失败路径永远测不到。
2. **标记串自匹配**：注入的 `<script>` 源码里也含 `###AUDIT###` 字面量，第一版 result 只有 25 字节、内容是字面量 `' + JSON.stringify(R) + '`。修法两条一起用：探针里把标记拆开拼（`'###AU'+'DIT###'`），且 run 端取**最后一个**匹配而不是第一个。

**探针自身的一个缺陷（本轮新发现，务必留意）**：焦点环扫描那段 walk 写成了 `if (r.cssRules) { walk(r.cssRules); return; }`；在支持 CSS Nesting 的 Chrome 里，**普通 `CSSStyleRule` 的 `r.cssRules` 也是真值**（一个空的 `CSSRuleList` 对象），于是每条样式规则都提前 `return`，`/:focus/.test(r.selectorText)` 一次都没执行 → 输出的 `focusRingRules={suppressors:[],rings:[]}`、`focusOutlineNone=[]` 是**假阴性**（源码里明明有 `.input-panel input:focus{outline:none}` 与 `.btn:focus-visible`）。修法一行：去掉那个 `return`，改成同文件里 `reducedMotion` 段那样的 `if (r.cssRules) walk(r.cssRules);`（不带 return）。这就是下文「确定要修的问题」第 3 条至今只能保留为静态推断的原因。

**实测确认清单**（把静态推断升级为实测的部分）：

- **canvas 无障碍**：14 个 canvas 的 `role` / `aria-label` / `tabindex` **全部为 null**。
- **结构**：landmarks 计数全 0、`roleAttr=0`、`skipLink=0`、全页 live region 计数 `live=0`；可聚焦元素 `focusTotal` fourier 9 / laplace 19。
- **对比度**：每页只有 **1 个** fail 签名 —— `#7b87a6` on `#16213e` = 4.43:1、11.2px、weight 400、样本文本 `"Function f(t) ="`、命中 7 处（fourier）/ 12 处（laplace）。另有 inconclusive 签名 fourier 10 个 / laplace 18 个，包含 `h1 40.8px w600`、`h2 22.7px w600`、`button#btnGenerate 15.2px w600`、`div.note 12.5px w400`、`sup 12.5px "−σt"`、`sub 10.4px "10"`、`span.preset-label 11.2px`、`button#presetExp/Ring/Step 12.8px`（inconclusive = 元素背景是渐变/透明叠层，探针拿不到确定的合成底色，不代表通过）。
- **`<html lang>`**：fourier `zh-CN`、laplace `en`，与静态核对一致。（2026-09-22 起 fourier 已改为 `en`，见上节。）
- **CDN**：base 下 `mathLoaded=true katexLoaded=true`，`katexNodes` 49（fourier）/ 93（laplace）。offline 下 `btnText="math.js failed to load — check network"`、`btnDisabled=true`、`loadingVisible=true`、`loadingText="⚠️ Failed to load math.js. Please check your internet connection and refresh."` —— **失败提示确实会出现，但没有任何 live region 播报**，读屏用户不会被告知。
- **`prefers-reduced-motion`**：`matchesReduce=false`（本机未开启，属预期）、`guardedRules=1`、`animationRules=1`（就是守卫自己那条 `animation:none`，位于 `fourier_transform.html:209` / `laplace_transform.html:234`，也是页面自有 CSS 里唯一的 animation 声明）、`infiniteAnimationRules=0`、`transitionRules` 4（fourier）/ 5（laplace）、`sheetsUnreadable=1`。媒体查询位置：`fourier_transform.html:207`、`laplace_transform.html:232`、`ft_laplace/index.html:83`。**JS 侧没有任何 `matchMedia` 调用** → canvas 内的 requestAnimationFrame 动画不受这个守卫管；因为两页都不自动播放动画，实际影响较小。
- **class 计数**（用于验证「死 CSS」判断）：`btn-danger` **6 次运行全为 0**、`btn-primary` 1/1、`play-btn` 1/1、`btn-preset` 0/3、`radio-group` 0/1、`canvas-box` 5/8、`note` 1/2。
- **canvas 位图密度**（`bpc` = CSS 像素 / 位图像素，>1 表示在放大发虚）：fourier `canvasSignal` 1000×350、`canvasGrid` 900×1890、`canvasAnim` 650×650、`canvasCOM*` attr 500×300 / css 343.3×206 / bpc=1.46（缩小，无害）；laplace 另有 `canvasMap` 900×520、`canvasFamily` 900×340、`canvasSpiral` 760×520，以及 **`canvasSliceA` / `canvasSliceB`：attr 500×300 / css 521×312.6 / bpc=0.96 / `upscaled=true` —— 在 dpr=1 下就已经在放大**。dpr15 变体下 14 个 canvas **全部** `upscaled=true`。
- **其余实测细节**：播放按钮的可读名是符号 `▶`（无文本替代）；fourier 有 2 个 `<input type="range">` 无可访问名，laplace 0 个；孤立 `<label>`（`for` 指向不存在的 id 或无关联控件）fourier 4 个 / laplace 5 个；`<img>` 的 `hasWidthAttr=false`、`hasHeightAttr=false`。

### 局限

实测覆盖了 DOM/CSS/布局/canvas 尺寸这些**探针能读到的东西**，剩下的盲区是：

- **canvas 内 `fillText` 画的文字测不到对比度** —— 而这恰恰是真问题：`laplace_transform.html:1821,1878` 确实在 canvas 里用了 `ctx.fillStyle='#7b87a6'`（就是 DOM 侧唯一那条 fail 的同一个颜色）。
- **KaTeX 的跨域样式表读不到 `cssRules`**（`sheetsUnreadable=1`，base 与 offline 都是 1），所以公式内部文字的对比度完全未测。
- `--force-device-scale-factor` 不等于真实的 Windows 显示缩放，dpr15 的数据只能当趋势看。
- 这是**手写探针，不是 Lighthouse / axe**：没有规则 ID、没有分数、没有完整的规则覆盖面，而且焦点环扫描那一段已被证明有缺陷（见上）。要拿"通过 Lighthouse"这种结论，仍需真跑一次 Lighthouse。
- 子项目二的四个页面本轮只交叉核对了「约定是否存在」（四条 canvas `role="img"` 已确认），**没有**做同样的逐页体检。

## 代码风格与开发约定

- **注释与文档语言**：仓库级文档（根 `README.md`、本文件）与子项目二的文档使用中文；根 `index.html`、子项目一的页面与子项目二的五个页面**界面文案都是英文**（根页 2026-09-22 由中文译为英文，子项目二五页 2026-09 由中文译为英文），子项目一的 `AGENTS.md` 用中文。改动时沿用所在文件已有的语言习惯，不要在同一文件里混语言。
- **`<html lang>` 现状**：根 `index.html`、`ft_laplace/` 三页与两个跳转页都是 `en`（`fourier_transform.html` 的 `zh-CN` 是 2019 年遗留、内容实为英文，2026-09-22 已改；根 `index.html` 随英文化一并改为 `en`）；子项目二的全部页面也是 `en`（界面文案 2026-09 由中文译为英文，lang 随之一并改）。
- **标识符一律英文**：子项目一是 camelCase 全局函数（`drawAnim`、`meanList`、`kernelPass`、`sMap`、`famSplitSigma`）；子项目二同样 camelCase（`computeCurve`、`xwNow`、`bucketOf`），`st` / `state` 是统一的状态对象名。
- **`var` 与 `const/let` 混用**：子项目二的 `ift.js`、`bridge.js`、`laplace.js`、`common.js` 用 `var`，只有 `fsls.js` 用 `const/let` 与箭头函数。改哪个文件就跟着哪个文件已有的写法，不要顺手统一。
- **相对路径是硬约束**：两个子项目内部的一切引用（`assets/*.css`、`assets/*.js`、页面互链）都必须是相对本目录的相对路径。这正是它们能被整体搬进子目录、并部署在任意子路径下而互不干扰的原因。**禁止改成绝对路径或以 `/` 开头的路径。**
- **仓库根不承载可视化代码**：新增一个案例 = 新建一个子目录放页面，再在根 `index.html` 卡片区加一张卡片；不修改已有子项目。
- 两套子项目配色不同，不要互相"统一"：`ft_laplace/` 与根页用 `--bg #1a1a2e` / `--surface #16213e` / `--text #e0e0e0` / accent `#4cc9f0`；`fs_inv_ft_inv_laplace/` 用 `--bg #0a1020` / panel `#111c30` / `--accent #ff5d5d` / `--accent2 #7fd1ff`。子项目一里画布填充色必须等于 CSS 变量 `--surface`、标签色等于 `--text`。
- **无障碍与性能是既有约定，新增/改动页面请延续**：四个页面都尊重 `prefers-reduced-motion`（系统开启"减少动态效果"时默认暂停动画，可手动播放）、提供键盘操作、`<canvas>` 带 `role="img"` 与 `aria-label`、canvas 有 `tabindex`；`devicePixelRatio` 上限夹到 2；隐藏标签页时暂停绘制。子项目一的拉普拉斯页使用离屏 canvas + `drawImage` 让滑块拖动不重算热力图。**注意适用范围：这条约定目前只在子项目二成立**，`ft_laplace/` 的两页实测不满足（14 个 canvas 全无 `role`/`aria-label`/`tabindex`，无 `devicePixelRatio` 处理，无 `visibilitychange` 暂停），逐项清单见上文「无障碍与性能体检」一节。
- **数学约定（子项目一，改动前务必确认）**：缠绕核角度一律取 `-omega*t`（即 e^(−jωt)），不要改回正号；拉普拉斯页 ω 的单位是 rad/s 而不是 Hz；求和惯例是直接累加各采样点值（不除 N）并按 `dt` 缩放到积分量级；全程不做符号运算，极点和收敛域只从图上读出来。子项目二的详细约定见其 README 与页面内 `.note` 说明文字。

## 部署

GitHub Pages，**Deploy from a branch → `main` → `/ (root)`**。站点 URL 形如 `https://<用户名>.github.io/<总仓库名>/`：

- 根目录 `index.html` → 站点首页（总览）；
- `ft_laplace/index.html`、`fs_inv_ft_inv_laplace/index.html` → 两个子站枢纽页；
- 根目录的两个跳转页接管合并前的旧地址。

根目录的 `.nojekyll` 用于关闭 Jekyll 处理。由于全站使用相对路径，部署在任意子路径下都能正常工作。

## 版本控制与仓库历史

- `origin` = `git@github.com:xidianhush/Fourier_Series_and_Fourier_Transform_and_Laplace_Transform_Visualization`（**SSH**）
- `upstream` = `https://github.com/thatSaneKid/fourier.git`（2019 年原仓库，仅作参考）
- 当前分支 `main`（跟踪 `origin/main`，工作区干净）。本地另有一个未推送的 `feature/use_exponential_function_as_input`。
- 标签 `pre-merge` 标记合并前的状态，回退用 `git reset --hard pre-merge`。
- 提交信息用英文。

**合并历史**：本仓库由两个各自独立的 Git 仓库合并而成——`ft_laplace/` 来自原仓库 `xidianhush/Fourier_Series_and_Fourier_Transform_and_Laplace_Transform_Visualization`，`fs_inv_ft_inv_laplace/` 来自另一个独立的本地仓库。合并采用「保留历史 + 子目录隔离」：两边各加一个"把文件移进子目录"的提交，再合并两条无关历史（合并提交 `d80acce`），**合并前 23 个提交的 SHA 一个都没变**，因此这是一次普通快进推送，没有 force-push。合并只改了文件层级，两个子目录内没有一行页面代码被改动。

**本机环境（实测，换机器后需重新确认）**：github.com 直连不通，git 走 `http.proxy = http://127.0.0.1:7897`；SSH（`git@github.com`）可用，所以推送用 SSH 地址而不是 HTTPS。CDN 只有 jsdelivr 可达，cdnjs/unpkg 不通——`ft_laplace/` 的两个页面因此以 jsdelivr 为主地址、cdnjs 为回退。

## 安全注意事项

- **`ft_laplace/` 的两个页面会在浏览器端执行用户输入的函数表达式**（`math.compile(funcStr)`，用 mathjs 编译并数值求值）。这是功能设计——等价于让访问者运行自定义数学函数——只作用于其本人浏览器会话、不涉及任何服务器。但若要把这些页面部署到不信任的共享环境，应知晓这一点。子项目二不加载外部库、不 eval 用户输入，没有这个问题。
- 子项目一的两个页面依赖外部 CDN（mathjs、KaTeX），存在网络依赖；离线环境不降级，仅提示加载失败。
- notebook 可执行任意 Python 代码，与普通 Jupyter 行为一致——不要打开或运行不可信来源的 notebook。
- 本仓库不含任何服务端代码、密钥或凭据；`tools/check.js` 只在本地读写临时文件并调用本机 Chrome。

## 修改指引

| 要改的地方 | 先读 | 改完跑什么 |
| --- | --- | --- |
| 仓库根（总览页、跳转页、README、部署配置） | 本文件、根 `README.md` | 浏览器打开根 `index.html` 逐层点进两个子站 |
| `ft_laplace/` 下的页面或 notebook | `ft_laplace/AGENTS.md`（含逐节实现细节与"勿改回去"清单）；改无障碍/配色/焦点样式时另读本文件「无障碍与性能体检」 | 无自动化；人工打开页面/重跑 notebook。改无障碍相关时，对照「无障碍与性能体检」的清单逐条核，并用 Chrome DevTools 的 Lighthouse 跑一遍（注意该节列出的已知误报） |
| `fs_inv_ft_inv_laplace/` 下的页面或脚本 | `fs_inv_ft_inv_laplace/README.md` | `node fs_inv_ft_inv_laplace/tools/check.js` |

改动任何一份 `AGENTS.md` 或 `README.md` 所描述的事实（命令、路径、约定、分支、部署方式）时，**同步更新那份文档**，保持文档与代码一致。
