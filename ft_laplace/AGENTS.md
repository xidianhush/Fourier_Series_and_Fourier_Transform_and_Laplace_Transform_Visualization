# AGENTS.md

本文件供 AI 编码代理阅读,目的是让不了解本项目的读者快速掌握项目全貌。阅读者被假定对本项目一无所知。

## 项目概述

这是一个关于傅里叶变换的可视化教学项目,基于 3Blue1Brown 的科普视频《But what is the Fourier Transform?》(https://www.youtube.com/watch?v=spUNpyF58BY)。

核心思路(视频中的"质心法"):把输入信号按不同的采样频率 f 缠绕到圆上(极坐标形式 amp·e^(i·2πft)),然后跟踪缠绕图形的质心 x 坐标。当 f 恰好等于信号中的某个频率时,质心会明显偏向一侧,由此可以识别信号中包含的频率成分。

项目包含以下交付物:

| 文件 | 说明 |
|------|------|
| `Fourier Transform - A Visual Introduction.ipynb` | 主 Jupyter Notebook,用 Python(numpy / matplotlib / seaborn / ipywidgets)完整实现质心法,并带 ipywidgets 逐帧动画 |
| `fourier_transform.html` | 独立可运行的静态网页版(原生 HTML + JavaScript + mathjs),无需任何 Python 环境,浏览器直接打开即可 |
| `laplace_transform.html` | 姊妹网页版:把缠绕核从 e^(-jωt) 换成 e^(-st),讲 σ 包络、极点与收敛域;同样零构建、单文件 |
| `index.html` | 零构建的深色落地页,两张卡片分别指向上面两个网页 |
| `README.md` | 简要说明与依赖安装指引 |

默认输入信号是双边指数衰减信号 f(t) = e^(-2|t|)(t ∈ [-2, 2]),频率扫描范围 -10–10 Hz、步长 0.1 Hz(共 201 个频率)。注意文件名带空格。
拉普拉斯页面的默认输入是单边 exp(-2*t)(窗口 [0, T],T = 2),积分范围可选单边 ∫₀^T 或双边 ∫_{-T/2}^{T/2}。

## 技术栈

- **Notebook 版**:Python 3(nbformat 4 / nbformat_minor 2,notebook 由 Python 3.11.8 环境生成)
  - numpy(数值计算)
  - matplotlib(`%matplotlib widget` 交互后端)
  - seaborn(美化绘图,`sns.set()`)
  - ipywidgets / ipympl(动画控件:Play、IntSlider、HBox/VBox、jslink、interactive_output)
  - IPython.display(嵌入 YouTube 视频)
- **网页版**(两个单文件页面):纯静态 HTML/CSS/JavaScript,零构建步骤、无包管理器
  - mathjs 12.4.1(CDN 加载:jsdelivr,失败时回退到 cdnjs),用 `math.compile` 编译用户输入的函数并数值求值——2026-09-24 起是两页仅剩的网络依赖
  - 公式排版用页尾内联的迷你 TeX 渲染器(子项目二 `assets/tex.js` 的内联副本,2026-09-24 取代 KaTeX):`texify()` 在 DOMContentLoaded 时渲染全页 `.tex`/`.tex-block` 元素,公式写法 `<span class="tex">…</span>` / `<div class="tex-block">…</div>`;渲染不了的片段显示成带红虚线框的原样文本,零网络依赖
  - HTML5 Canvas 绘图;`laplace_transform.html` 第 4 节的热力图先画到离屏 canvas 再整块 `drawImage`,滑块拖动时不重算
  - 单文件、界面文案全英文(三个页面的 `<html lang>` 均为 en;`fourier_transform.html` 的 lang 属性原是 2019 年留下的 zh-CN,2026-09-22 已改为 en)
  - 视觉风格:2026-09-24 起全站统一为子项目二的「深蓝黑仪表盘」——底 `--bg #0a1020` / 面板 `--surface #111c30` / 画布底 `--canvas #0e1626`(画布底色与面板底色分离) / 正文 `--text #e8eefc` / 次级 `--text-dim #8fa2c4` / 交互强调青 `--accent #7fd1ff` / 关键标注红 `--accent2 #ff5d5d` / 边线 `--hairline #22314d`;JS 画布填色必须用 `--canvas` 的值 `#0e1626`、标签用 `#e8eefc`,质心点等关键标注用红

## 仓库中的位置(2026-09 合并后)

本工程不再是一个独立仓库,而是总仓库 `Fourier_Series_and_Fourier_Transform_and_Laplace_Transform_Visualization` 下的子目录 **`ft_laplace/`**。总仓库根目录另有:

- `index.html` — 总览页,两张卡片分别指向 `ft_laplace/index.html` 与姊妹工程 `fs_inv_ft_inv_laplace/index.html`;
- `fourier_transform.html`、`laplace_transform.html` — 旧地址跳转页,把合并前的两个 Pages 地址重定向到本目录下的同名页面;
- `fs_inv_ft_inv_laplace/` — 姊妹工程(傅里叶级数、傅里叶/拉普拉斯反变换),与本工程互不依赖。

本目录内的引用全部是相对本目录的相对路径,合并时一行未改;因此下面的结构说明仍按 `ft_laplace/` 自身为根来写。

## 目录结构与模块划分

```
ft_laplace/
├── Fourier Transform - A Visual Introduction.ipynb   # 主 Notebook(单边傅里叶版)
├── fourier_transform.html                            # 傅里叶网页版交互实现
├── laplace_transform.html                            # 拉普拉斯网页版(姊妹页)
├── index.html                                        # 落地页,两张卡片指向上面两个网页
└── README.md
```

Notebook 共 4 个章节:

1. **生成信号** — 定义指数衰减信号 `exp_signal = np.exp(-alpha * t)`,`alpha = 2.0`,t 从 0 到 2、步长 0.001。
2. **缠绕信号** — 对每个采样频率 sf,构造极坐标点 (幅值, 角度):
   - `r_cord[l] = [(exp_signal[i], t[i]*sf*2*np.pi) for i in range(len(t))]`
   - 再转直角坐标 `x_cord`(amp·cosθ)、`y_cord`(amp·sinθ)
   - 绘制全部子图(约 100 个、每行 4 个),红色圆点标记质心
   - `mean_list` 保存每个频率下 x 坐标之和(供第 4 节画质心曲线)
3. **动态交互动画** — 用 ipywidgets 的 Play / IntSlider / jslink 实现"播放",逐帧绘制缠绕曲线,红色点实时显示质心。
4. **质心 vs 采样频率** — 折线图、平滑图、柱状图:
   - 平滑阈值取最大值的一定比例:`smoothed = [i if i>0 and i>0.2*max(mean_list) else 0 for i in mean_list]`

网页版 `fourier_transform.html` 的 JavaScript 结构(无模块化,全部是全局函数,自上而下依次为):

- 全局常量/状态:`NUM_POINTS = 2000`、`t`、`signal`、`sfList`、`xCord`、`yCord`、`meanList`,以及各 canvas 的 2d context。
- `generate()` — 读取输入参数,用 mathjs `math.compile(funcStr)` 编译用户函数,生成时间序列与信号,计算 xCord/yCord/meanList,最后统一调用各绘图函数;计算放在 `setTimeout(..., 30)` 里以便先渲染 loading 提示。缠绕角取 `-t[i]*2πsf`(即 e^(-j2πft),与第 5 节定义一致;旧版是 e^(+j2πft),两者只差共轭,勿再"修"回去)。
- `drawSignal()` — 第 1 节:信号曲线;时间轴跨越 0 时额外画一条 t = 0 的虚线基准。
- `drawGrid()` — 第 2 节:10 列子图网格,按频率数动态撑高画布以保持正方形格子(201 个频率 → 21 行),每格画缠绕曲线与质心红点。
- `computeGlobalRange()` / `drawWindingCell(ctx, k, numPoints, rect, opts)` — 第 2、3 节共用的缠绕绘图:先对所有频率计算统一的全局范围 `gRange`,再按该范围绘制单个缠绕图(坐标轴穿过数据原点 (0,0));`drawGrid` 逐格调用、`drawAnim` 每帧调用(传 `frame+1` 只画到当前帧)。
- `drawAnim(freqIdx, frame)` / `togglePlay()` / `animStep()` — 第 3 节:逐帧播放动画(每 40ms 前进 10 帧)。
- `drawCOMPlots()` / `drawLinePlot()` / `drawBarPlot()` — 第 4 节:三个并排图(原始质心、平滑后、柱状);网页版阈值按 `|v| > 0.2*max|meanList|` 取并保留符号(与 notebook 的 `i>0` 规则不同),柱状图自零线起向正负两侧画。
- 第 5 节为静态 HTML 讲解(英文,标题 "Understanding the Geometric Meaning of Fourier Transform & Spectral Density",推导按双边傅里叶变换展开:采样窗口 -T/2→T/2,终点积分区间 ∫_{-∞}^{∞}),公式由页尾内联的迷你 TeX 渲染器排版:全页 `.tex`/`.tex-block` 元素在 DOMContentLoaded 被 `texify()` 渲染(2026-09-24 取代 KaTeX);末尾的几何示意图同日起改为 Canvas 实时绘制(`#geoFig` 画布,`drawGeoFigure()` 在主脚本解析时执行、不依赖 mathjs),取代原手绘 jpg(原 jpg 文件已删)。
- `onMathReady()` / `checkMath()` — 轮询等待 mathjs 就绪后自动 `generate()`;8 秒超时在页面上提示 math.js 加载失败。
- 事件监听:频率/帧滑块 `input` 事件、输入框回车触发 `generate()`。

网页版 `laplace_transform.html` 的 JavaScript 结构(同样是全局函数、无模块化,自上而下依次为):

- 全局常量/状态:`NUM_POINTS = 2000`(显示窗口采样)、`N_MAP = 1000`(地图窗口采样)、`MAP_SIGMA_N = 81`、`MAP_OMEGA_N = 121`、`GRID_COLS/GRID_ROWS = 11`、`ENV_CLAMP = 700`;`mode`('unilateral' / 'bilateral')、`T`、`TMap`、`tArr`、`sig`、`omegaList`、`xCord`/`yCord`、`sumList`、`sMap`、`famCurves` 等,以及各 canvas 的 2d context。
- **单一数值核** `kernelPass(sigma, omega, tArr, sig, dt, out, env)` 与包一层的 `Fsum(sigma, omega, tmin, tmax, N, sigIn)`:按 dt 缩放的 Σ f(t_i)·e^(-s·t_i),s = σ + jω。缠绕角一律取 `-omega*t`(即 e^(-jωt),与傅里叶页同约定,勿改回正号);每个采样点用单位相量递推(一次复数乘)代替 cos/sin,**递推初值必须取窗口起点的绝对相位** `e^(-jω·t₀)`(即 `Math.cos(-omega*tIn[0])`):若从 1 开始,整条曲线与求和会被乘上一个 e^(-jωt₀),单边窗口因 t₀=0 看不出来,双边窗口下则会让每一格缠绕图随 ω 刚性旋转、相位读数全错;`env` 可传入预算好的 e^(-σt) 行(同一个 σ 被 121 个 ω 复用);`out` 非空时会顺带写出每个采样点的缠绕坐标。`envExp` 把指数夹在 ±700,避免溢出成 Infinity/NaN。
- `generate()` — 读面板(`readPanel`)→ 定窗口(`setWindow`:单边 [0,T] / 双边 [-T/2,T/2])→ 采 2000 点 → 121 个 ω → `setupSliders()` → `buildMap()`(第 4 节)→ `buildFamily()`(第 5 节)→ `refreshCheap(true)`;同样放在 `setTimeout(..., 30)` 里以便先渲染 loading 提示。异常提示与 mathjs 就绪轮询(`onMathReady` / `checkMath`)沿用傅里叶页写法。
- 廉价重绘路径:`refreshWinding()`(算当前 σ 的包络 + 121 条缠绕曲线 + 第 3 节那条按精确 ω 的曲线)与 `refreshCheap(rebuild)` / `setSigma(v)` / `setOmega(v)`。σ/ω 滑块只走这条路,**不重算热力图**;两张切片各自记住"为哪个 ω/σ 算的"(`sliceAOmega` / `sliceBSigma`),只有对应坐标动了才重算。
- 第 1 节 `drawEnvelope()` / `envelopeStats()` — 同图三条线:f(t)、包络 e^(-σt)(虚线)、乘积 f(t)·e^(-σt)(粗线);窗口底色 + t = 0 竖线;读数 max|f·e^(-σt)|(非有限值显示 ∞)。
- 第 2 节 `drawGrid()` / `drawWindingCell(ctx, xk, yk, numPoints, rect, opts)` — 11×11 = 121 格,按行数动态撑高画布(121 个 ω → 900px);每格**先 `ctx.save(); clip()` 再画曲线**,曲线半径超过固定可视半径(窗口内 max|f|,不随 σ 变)时在右上角画 ⚠ 并把质心红点吸附到框边。比例固定是刻意的:σ 出收敛域时曲线必须真的冲出格子。
- 第 3 节 `drawAnim(frame)` / `togglePlay()` / `animStep()` — σ、ω 两个滑块 + Play,曲线逐帧从窗口起点长出;底部读数给出 t、Re/Im/|F|/∠F(由 `partialSum` 对已画出的采样点求和)。
- 第 4 节 `buildMap()` / `paintMapBitmap()` / `drawMapOverlay()` / `findFront()` / `colorFor(v)` / `computeSliceA()` / `computeSliceB()` / `drawSlices()` / `drawSlicePlot()` — 81(σ)×121(ω) 的 log10|F| 地图,用**内部长窗口 `T_map`(默认 20,可调 5–50)**,与显示窗口 T 无关;色标锚在 log10|F| 的 10% 分位数、跨 4 个数量级(默认信号下数值前沿落在 σ ≈ -2.3);叠加当前 (σ, ω) 十字光标与竖直前沿虚线;下面是两张切片(A:对 σ 定 ω;B:对 ω 定 σ)。热力图用 `ctxMap.drawImage(离屏 bitmap)`,所以拖滑块只重画叠加层。
- 第 5 节 `buildFamily()` / `findFamilySplit()` / `drawFamily()` — 同一信号、窗口 T/2T/4T 三条 log10|F| 对 σ 曲线(ω = 0 切片);收敛域内三条重合,域外扇形张开;分岔判据是"最长窗与最短窗的差距超过窗长比"(log10 4 ≈ 0.6 个数量级),再插值给出极点实部(默认信号 → σ = -2.00)。σ 范围没覆盖极点时返回 null,界面显示 "no split found in this σ range"。
- 第 6 节 `drawSpiral()` / `projectPoint(...)` — 手写正交投影(先绕竖直轴转 `thetaY`,再固定俯仰 `PITCH = 0.38`),不引 three.js;细线是核螺旋 e^(-st)(半径 e^(-σt),绘制时夹在 3 倍框内),粗线是 f(t)·e^(-st),另有原点、t 轴与当前采样点;水平拖动/触摸拖动改 `thetaY`,只旋转不平移缩放。
- 第 7 节为静态 HTML 英文讲解(7 个小标题:从傅里叶到拉普拉斯、质心→积分、σ 的意义、极点、收敛域、有限窗口的诚实说明、3D 螺旋读法),公式排版同傅里叶页:页尾内联的迷你 TeX 渲染器在 DOMContentLoaded 对全页 `.tex`/`.tex-block` 元素调 `texify()`(2026-09-24 取代 KaTeX;第 1–6 节的 prose 与图例里的公式也一并从 `$...$` 写法改成 `.tex` 元素)。
- 输入面板:`applyPreset('exp' | 'ring' | 'step')` 三个预设(分别设置函数、单边/双边、T、σ 与 ω);切单边/双边时 `onModeChange()` 会在 `exp(-2*t)` 与 `exp(-2*abs(t))` 之间改写默认函数;`toNumber()` 负责把 mathjs 可能返回的布尔值(阶跃预设 `(t>=0)`)、BigNumber、复数转成数值。

## 构建与运行

本项目**没有构建步骤,也没有任何配置文件**(无 pyproject.toml / package.json / requirements.txt)。

- **Notebook**:安装依赖后启动 Jupyter:
  ```bash
  pip3 install --user numpy matplotlib seaborn ipywidgets ipympl
  jupyter notebook "Fourier Transform - A Visual Introduction.ipynb"
  ```
  注意:第 3 节动画单元格依赖 `%matplotlib widget`(ipympl),首次使用需安装 `pip install ipywidgets ipympl`(notebook 第 3 节说明中已注明)。notebook 内嵌大量 base64 图像输出,文件很大,直接手工编辑 JSON 极易出错,应尽量用 Jupyter 界面编辑。
- **网页版**:用任意浏览器打开 `index.html`(落地页,两张卡片指向两个页面),或直接打开 `fourier_transform.html` / `laplace_transform.html`(需联网加载 mathjs CDN;加载失败时页面会在约 8 秒后给出网络错误提示)。

## 代码风格约定

- 注释语言混用:2026 年新增/修改的代码与说明使用中文(例如 `# 指数衰减信号`、`# 衰减系数`,第 2 节后的 markdown 详解、第 3 节标题均为中文),2019 年原始内容为英文。新增代码请沿用所在单元格/段落附近已有的语言习惯。
- 网页版界面文案全英文:`fourier_transform.html`、`laplace_transform.html`、`index.html` 三个页面的正文与提示语都是英文(三个页面的 `<html lang>` 均为 en);代码标识符统一用英文 camelCase(如 `drawAnim`、`meanList`、`funcInput`、`sfList`;拉普拉斯页另有 `kernelPass`、`sMap`、`TMap`、`famSplitSigma`)。
- 拉普拉斯页共用的约定:缠绕核角度一律 `-omega*t`(e^(-jωt),勿改回正号);ω 的单位是 rad/s(不是 Hz);画布填充色必须等于 CSS 变量 `--canvas`(#0e1626,2026-09-24 起画布底色与面板底色 `--surface` #111c30 分离)、标签色等于 `--text`(#e8eefc);求和惯例是直接累加各采样点的值(不除 N)并按 `dt` 缩放到积分的量级;第 4 节地图用内部长窗口 `T_map` 而不是显示窗口 `T`;全程不做符号运算,极点与收敛域只从图上读出来。
- Notebook 变量命名习惯:`r_cord`(极坐标点列表)、`x_cord` / `y_cord`(直角坐标)、`mean_list`(质心 x 之和)、`sf_list`(采样频率)。
- Notebook 绘图参数习惯:`plt.rcParams["figure.figsize"]` 常用 (12,4);第 2 节子图大图用 (15,110)。

## 测试

- 本目录内没有单元测试、没有 CI、没有自动化测试脚本(总仓库根的 `tools/visual_qa/` 提供全站 smoke 与视觉巡检,见下)。
- 验证以人工为主:
  - Notebook:按顺序执行各单元格,确认四节图形与第 3 节动画正常;
  - 网页版:浏览器打开,确认四节渲染与动画/滑块交互正常。
- 机器辅助验证(在总仓库根执行):`node tools/visual_qa/selftest.js ftl-index ftl-fourier ftl-laplace` 做无头 smoke;`node tools/visual_qa/shot.js ftl-fourier ftl-laplace` 出截图供人工/视觉模型审查;上线前的 Qwen 视觉巡检见根 `AGENTS.md` 与 `tools/visual_qa/README.md`。
- notebook 每次重新运行后,会产生 `execution_count`、widget `model_id`、内嵌 base64 图像等大量 diff,这是正常现象,不代表代码出错;提交时通常一并带上。

## 版本控制

- 仓库:origin = `git@github.com:xidianhush/Fourier_Series_and_Fourier_Transform_and_Laplace_Transform_Visualization`(SSH;2026-09 由原 `Fourier_Series_and_Fourier_Transform_Visualization` 改名而来,改名后 Pages 地址随之变化)。upstream = `https://github.com/thatSaneKid/fourier.git`(2019 年原仓库,仅作参考)。
- 分支:origin 上只有 `main`(当前分支,跟踪 `origin/main`,工作区干净)。本地另有一个未推送的 `feature/use_exponential_function_as_input`。
- 历史:2019-06 原仓库由 thatSaneKid 创建;2026-08 由 hushpro 扩展,新增逐帧动画、第 5 节讲解、网页版与 GitHub Pages 入口页;2026-09 把傅里叶页改成双边(时间与频率都跨 0),新增 `laplace_transform.html` 与落地页。
- 2026-09 合并:本工程与另一个独立的本地仓库(现为 `fs_inv_ft_inv_laplace/`)合并成同一个总仓库。办法是两边各加一个"把文件移进子目录"的提交,再合并两条无关历史(合并提交 `d80acce`),全程零改写 —— **合并前 23 个提交的 SHA 一个都没变**,所以这是一次普通快进推送,没有 force-push。合并前的状态由 `pre-merge` 标签标记,回退用 `git reset --hard pre-merge`。合并只改了文件层级,本目录内没有一行页面代码被改动。
- 本机环境(实测,换机器后需重新确认):github.com 直连不通,git 走 `http.proxy = http://127.0.0.1:7897`;SSH(`git@github.com`)可用,所以推送用 SSH 地址而不是 HTTPS。CDN 只有 jsdelivr 可达,cdnjs/unpkg 不通 —— 两个页面因此以 jsdelivr 为主地址、cdnjs 为回退。

## 安全注意事项

- 网页版通过 `math.compile` 在浏览器端执行用户输入的函数表达式,这是功能设计(等价于让访问者运行自定义数学函数),仅作用于其本人浏览器会话、不涉及任何服务器;但若要把该 HTML 部署到共享环境,应知晓它会在访问者浏览器中执行任意数学表达式。
- 页面依赖外部 CDN(mathjs),存在网络依赖;离线环境不降级,仅提示加载失败。
- Notebook 可执行任意 Python 代码,与普通 Jupyter 行为一致——不要打开或运行不可信来源的 notebook。
