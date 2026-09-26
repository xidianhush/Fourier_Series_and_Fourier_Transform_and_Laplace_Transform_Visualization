# 信号与系统 · 傅里叶 / 拉普拉斯可视化合集

四个单页交互可视化，主线是"信号 = 复指数信号的线性组合"：

| 页面 | 内容 |
| --- | --- |
| `Fourier_series_linear_superposition.html` | 周期信号的傅里叶级数：谐波关系的复指数信号线性叠加 |
| `From_Fourier_series_to_Fourier_transform.html` | T→∞ 时谱线变密、系数变矮，离散和过渡为傅里叶积分 |
| `Fourier_inverse_transform_synthesis.html` | 非周期信号的傅里叶反变换：遍布 ω 轴的 e^{jωt} 加权积分（黎曼和向量链）；右上频谱可切换为三维栅栏；复平面带比例尺与可选/默认开启的量程冻结、时域有 t=0 幅值轴 |
| `Laplace_inverse_transform_synthesis.html` | 拉普拉斯反变换：基为 e^{(σ+jω)t}、权重为 X(σ+jω) 的合成；右上恒为三维 s 平面栅栏；支持自定义 f(t)（X 由数值求积现算）与观测窗倍数 k 滑条 |

每页布局相同：上方复平面（旋转伸缩向量链首尾相接，端点 = 合成信号）与频谱视图，
下方时域视图（向量链在实轴上的投影随 t 变化）；右侧侧栏为参数与开关。
拉普拉斯反变换页的时域纵轴按观测窗 ±Tw 定标，窗外那截合成段淡画——σ≠0 时窗外
`|Re s(t)|` 是被 e^{σt} 放大的 Ω 截断误差，纳入定标会把窗内曲线压成一条直线。
该页的观测窗 ±Tw = k × 预设的尾巴时间，k 由「Window k」滑条调（0.3…3，默认 1，可一键复位）；
Tw 同时决定误差读数、纵轴定标、横轴半宽 Xw = clamp(Tr+Tw, 3Tw, 6Tw) 与播放回绕范围。
左上复平面的量程默认**冻结**在观测窗内链的最大幅度上（左下角一条 `|s| = …「比例尺」`给出绝对值），
所以链随 e^{σt} 胀缩、端点大小可以跨 t 比较；想看链永远铺满面板就取消「Frozen complex-plane scale」，
退回每帧自适应（代价是大小不可比）。

自定义 f(t)（预设下拉里选「custom f(t)」）走的是**数值路线**：`assets/expr.js` 把迷你数学
表达式（不是 LaTeX，但 `\sin`、`e^{-2t}`、`{}[]` 这类写法会被掰直）编译成数值函数，
X(σ+jω) 则在 ±60 s 内用中点法现算。因此它不依赖任何闭式解，代价是：ROC 只能数值估计、
极点/零点不画、σ 太贴 ROC 边界或信号太长时精度下降（页内会给出提示）。

两页的页内公式都用 **TeX 写法**写在元素文本里（`<span class="tex">rac{1}{2\pi j}</span>`），
由 `assets/tex.js` 在本地排成 HTML（分式、根号、竖排上下限、希腊字母…）——**零依赖、不联网、
不是 KaTeX**；渲染失败会露出红色虚线框（`.texerr`）。要真正任意 TeX，得把 KaTeX 本地化进
`assets/`（约 0.5 MB 含字体），目前刻意没做。

右上的频谱视图有两处三维化，都遵循同一套投影与交互（按住面板拖动改 yaw/pitch，双击恢复被静音分量）：

- 傅里叶反变换页勾选「3D spectrum fence」后：栅栏固定站在 σ=0 平面上，柱高 = 权重 |F(jnΔω)|·Δω/2π，
  颜色 = 该分量的 t=0 初相位 arg F(jnΔω)；σ 轴是留给拉普拉斯反变换的槽位。
- 拉普拉斯反变换页右上恒为 3D s 平面：水平面就是 s 平面（σ = Re s 轴、ω = Im s 轴），
  整排栅栏立在积分路径 Re s = σ 上并随 σ 滑条沿 σ 滑动，柱高 = 权重 |X(σ+jnΔω)|·Δω/2π，
  颜色 = 相位 arg X(σ+jnΔω)（实信号下相位在 ω 上奇对称，所以栅栏两侧配色镜像）；
  地板上还画出 ROC 绿带、极点和零点。
  该页复平面里的向量链与栅栏、以及傅里叶反变换页的频谱**同色**（都按 `phaseBucket` 相位分 24 桶），悬停柱体时链上对应段白色加粗、颜色一致。

## 本地运行

纯静态站点，无构建步骤：

- 直接双击 `index.html` 用浏览器打开；或
- 以本目录为静态根启动服务器，例如 `python -m http.server`，访问 `http://localhost:8000/`。

枢纽页与四个可视化页还会引用**仓库根**的 `../assets/drawer.css` 与 `../assets/drawer.js` 作为站内抽屉导航
（`</head>` 前 `<link>`、`</body>` 前 `<script … defer>`）：左侧图标悬停或点击即滑出全站页面清单。
代价是本目录**不再能单独拷出去独立使用**（以前可以）——那样抽屉会 404，页面本身仍能正常跑。
网络层面仍完全自包含：抽屉是本地相对路径的 CSS/JS，没有引入任何 CDN 或 npm 依赖。

## 目录结构

```
index.html                 枢纽页（四张卡片 + 本地运行说明）
Fourier_*.html / From_*.html / Laplace_*.html   四个可视化页（薄壳：结构 + 外链资源）
assets/common.css          共享样式（四页公共样式块 + 无障碍/错误条样式）
assets/common.js           共享工具（配色、格式化、Pointer Events 绑定、错误横幅）
assets/expr.js             自定义 f(t) 的迷你表达式解析器（零依赖，只被拉普拉斯页加载）
assets/tex.js              极简 TeX 子集渲染器（零依赖，五个页面都加载；不是 KaTeX）
assets/ift.js              傅里叶反变换页脚本
assets/fsls.js             傅里叶级数线性叠加页脚本
assets/bridge.js           级数→变换过渡页脚本
assets/laplace.js          拉普拉斯反变换页脚本
tools/check.js             开发验证脚本（语法 + 数学断言 + 无头渲染探针 + 像素扫描）
```

## 开发验证

需要 Node.js 与本机 Chrome/Chromium（用于无头渲染探针）：

```
node tools/check.js
```

脚本依次执行：各 `assets/*.js`（含 `expr.js`、`tex.js`）的 `node --check`；对 `assets/expr.js` 跑一组
解析/求值用例（隐式乘法、`**`、`e^{-2t}` 这类 LaTeX 味写法、`u(t)`、以及一批必须报错的输入）；
对 `assets/tex.js` 跑一组渲染用例（分式、根号、`\sum`/`\lim` 的竖排上下限、`\int` 的右下角上下限、
希腊字母、以及 5 条必须回退成 `.texerr` 的坏输入）；并在桩 DOM 里断言两页复平面的**量程冻结**（默认都勾上、`drawSc()` 与 t 无关、
端箭头长 ∝ |s(t)|、且量程 ≥ 窗内最大幅度——最后这条防的是"采样点漏掉 t=0"那个坑）与
**端点 ≈0 的三档画法**（`drawSc()`/`mxRef()`/`arrowInfo()`）；
在桩 DOM 中加载 `common.js`+`ift.js` 并断言黎曼和数学性质（链端点 = 精确 f(t) 等）；
同样方式加载 `common.js`+`expr.js`+`laplace.js`，断言权重 = X(σ+jnΔω)·Δω/2π、相位分色对实信号
奇对称（`phaseFrac(-N)+phaseFrac(N)=1`）、`chainAt(0).end` 落在 Bromwich 值附近，检查 3D s 平面的
投影几何（地板四角与高度轴都在面板内、栅栏柱竖直向上生长、改 yaw 后投影随之改变），检查观测窗
倍数 k 同时作用于 Tw 与 Xw，并把**自定义信号的数值 X 对拍闭式解**（`e^{-t}u(t)` → 1/(s+1)、
`e^{-|t|}` → 2a/(a²−s²)，相对误差 1.5% 以内）、尾巴/ROC 估计口径（与 sexp、gauss 预设一致）以及
「非法表达式报错但保留上一个可用信号」都断言一遍，另外还断言复平面量程冻结（`drawSc()` 在 t=0 与 t=3
上完全相同、端箭头长之比 = |s(t)| 之比；取消勾选后退回自适应）。随后对四个页面注入探针用无头 Chrome `--dump-dom`
确认无脚本错误（并统计 TeX 公式：未渲染完 / 有 `.texerr` / 分式没上下叠放的都算失败——探针挂在
`load` 上，因为 `tex.js` 在 DOMContentLoaded 才排版，立即跑会量到未排版的布局）；对傅里叶反变换页与拉普拉斯反变换页各截图做一次像素扫描——前者查时域曲线、
频谱谱线、轴标签与复平面比例尺（`barPx`），后者查 3D 面板里确实有相位分色的栅栏柱（含面板上半部即地板以上）、
ROC 绿带与极点标记，以及时域面板观测窗内离轴 ≥20px 的亮青像素（`winLift`：窗内曲线确实有
高度，而不是被窗外被 e^{σt} 放大的截断误差压到轴上）与复平面左下角比例尺的像素（`barPx`）。
最后再为拉普拉斯反变换页单独跑一次「自定义 f(t)」探针（切到 custom 预设、画一遍、量时域窗内离轴亮青像素 `lift`）。
Chrome 路径可用环境变量 `CHROME` 覆盖。

探针里钉住了画布尺寸（`.stage{width:1242px;height:730px}`）：`--dump-dom` 与 `--screenshot`
两次运行的视口大小并不相同，不钉住的话截图中的画布会被拉伸，像素扫描的坐标就对不上。

## 在总仓库中的位置

本工程是总仓库（`xidianhush/Fourier_and_Laplace_Visualization`）下的子目录 **`fs_inv_ft_inv_laplace/`**，与姊妹工程 `ft_laplace/`（傅里叶变换、拉普拉斯变换）并列。总仓库根目录的 `index.html` 是总览页，其中一张卡片指向本目录的 `index.html`；任意页面左侧另有全站共用的抽屉导航（`../assets/drawer.css` / `drawer.js`），可一层直达全站各页。

本目录内的引用全部是相对本目录的相对路径，合并时一行未改，因此下面的结构说明仍按本目录自身为根来写。

## 发布到 GitHub Pages

本工程不再单独发布，而是随总仓库一起发布：

1. 总仓库的 Settings → Pages → Source 选 `Deploy from a branch`，branch 选 `main`、目录选 `/ (root)`。
2. 站点 URL 形如 `https://<用户名>.github.io/<总仓库名>/`，本工程的枢纽页即 `…/fs_inv_ft_inv_laplace/index.html`。

站点全部为相对路径引用，部署在任意子路径下均可工作——本工程正是这样被整体搬进子目录，而页面之间互不干扰。

## 浏览器支持

需要支持 Canvas 2D 与 Pointer Events 的现代浏览器：Chrome / Edge ≥ 88、Firefox ≥ 85、Safari ≥ 14。
尊重 `prefers-reduced-motion`：系统开启"减少动态效果"时页面默认暂停动画，可手动播放。

## 许可

MIT，见 `LICENSE`。
