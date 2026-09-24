/* 功能点清单（纯数据）。每项 {id, page, title, goal, passCriteria, maxTurns}。
   page 是 shot.js/readiness.js 里的 key（两个 redir 跳转页不进清单）。
   goal 与 passCriteria 用中文写给视觉模型看；页面 UI 全部是英文，控件坐标见每轮的控件清单。
   控件 id 已逐一核对源文件（见各项括号内注释）。 */
'use strict';

module.exports = [
  /* ---------- 根总览页（index.html：两个 .card，各含一个 a.go 链接） ---------- */
  {
    id: 'root-nav', page: 'root', maxTurns: 10,
    title: '两张卡片分别进入两个子项目枢纽页',
    goal: '这是仓库总览页（英文 UI）。页面中部有两张卡片：第一张 "Fourier Transform & Laplace Transform"（链接文字 Open ft_laplace/index.html →），第二张 "Fourier Series & Inverse Transforms"（链接文字 Open fs_inv_ft_inv_laplace/index.html →）。先点第一张卡片的链接，点完一张卡确认落地后（驱动会反馈新页面 URL），用 {"action":"back"} 动作返回枢纽页，再点下一张。每次点击后页面会跳转，截图会更新。',
    passCriteria: '两次点击后分别到达：①标题为 "Fourier & Laplace — Visual Introductions" 的页面；②标题为 "Signals & Systems · Fourier / Laplace Visualization Collection"、含四张卡片的页面。两个落地页都正常渲染、无空白。',
  },

  /* ---------- ft_laplace 枢纽页（两张 .card，a.go 指向 fourier/laplace 交互页） ---------- */
  {
    id: 'ftl-index-nav', page: 'ftl-index', maxTurns: 12,
    title: '两张卡片导航到两个交互页',
    goal: '这是 ft_laplace 子项目枢纽页（英文 UI）。两张卡片分别链接到 fourier_transform.html（Open fourier_transform.html →）与 laplace_transform.html（Open laplace_transform.html →）。依次点进两张卡片确认导航有效；点完一张卡确认落地后（驱动会反馈新页面 URL），用 {"action":"back"} 动作返回枢纽页，再点下一张。',
    passCriteria: '第一次点击后到达傅里叶变换交互页（大标题 "Fourier Transform: A Visual Introduction"，有函数输入面板与多个画布）；返回后第二次点击到达拉普拉斯变换交互页（标题含 "Laplace Transform"，有 σ 滑块与多个画布）。',
  },

  /* ---------- ftl-fourier（ft_laplace/fourier_transform.html） ----------
     已核对控件：#funcInput(text) #tMin #tMax #freqMin #freqMax(number) #btnGenerate
     #animFreq(range) #animPlayBtn(▶) #animFrame(range)；canvasSignal/canvasGrid/canvasAnim/
     canvasCOMRaw/canvasCOMSmooth/canvasCOMBar/geoFig（§5 的 Canvas 插图）。 */
  {
    id: 'ft-load', page: 'ftl-fourier', maxTurns: 16,
    title: 'mathjs 就绪并自动出图',
    goal: '打开傅里叶变换交互页（英文 UI），不做任何点击，只向下滚动观察。页面很高（约 9500px），每轮【驱动实测状态】里的"滚动=当前/总高"告诉你位置，scroll 的 dy 用 800（约一屏）。逐项确认，见过即算，不要求同屏。',
    passCriteria: '四项都见过立即 done pass：①首屏 #btnGenerate 可用（文字 "Generate!"，不是 "Loading math.js..."）且无红色 "Failed to load math.js" 提示；②滚到 §1 "The signal" 看到信号曲线；③滚过 §2 "Wrapping the signal" 看到缠绕网格与红色质心点；④滚到 §5 讲解区，公式是排版后的数学式（无裸露 $...$）。',
  },
  {
    id: 'ft-generate', page: 'ftl-fourier', maxTurns: 12,
    title: '修改函数表达式并重新生成',
    goal: '在顶部 "Function f(t) =" 输入框（#funcInput）把函数改成 sin(2*pi*3*t)：直接用 type 动作（系统会自动点击、全选、输入，不用先点输入框），然后点 "Generate!"（#btnGenerate）。注意：本页顶部有一个 YouTube 嵌入视频框，本地 file:// 下它会显示"视频播放器配置错误 / 错误 153"黑框，这是已知离线现象、与页面功能无关，判定时忽略它。',
    passCriteria: '三条都见过立即 done pass：①type 完成且点击 Generate 后，除上述 YouTube 黑框外无其它红色错误横幅、输入框无报错；②§1 信号曲线变成明显更密的振荡（肉眼可见变密即可，不要数周期个数）；③滚到 §4 看到三张质心图都有曲线。Generate 只点 1 次，点后重算需几秒，滚动等待即可，不要重复点。',
  },
  {
    id: 'ft-anim', page: 'ftl-fourier', maxTurns: 10,
    title: '播放/暂停逐帧动画',
    goal: '滚到 §3 "Frame-by-frame animation"，点击圆形播放按钮（#animPlayBtn，初始文字 ▶ = 已暂停，点击后播放）。流程：点 1 次播放，对比两张连续截图确认 Frame 读数/#animFrame 滑块在前进；再点 1 次确认停住。按钮图标 ▶/⏸ 表示点击后的动作，不是当前状态。',
    passCriteria: '①播放时 Frame 读数逐张截图前进、缠绕动画画面变化；②暂停后停住、按钮回到 ▶。确认后立即 done pass，本项点击播放键不超过 3 次。',
  },
  {
    id: 'ft-freq-slider', page: 'ftl-fourier', maxTurns: 8,
    title: '拖动 Freq 滑块切换缠绕频率',
    goal: '先 find "#animFreq" 把 §3 滚进视口（find 返回的新中心坐标照抄用于 drag）。在 §3 动画控制区，把 "Freq #" 滑块（#animFreq）向左或向右拖动一段距离。',
    passCriteria: '拖动后 "Freq #" 滑块旁的读数与拖动前不同，即通过——读数变了立即 done。不要追求拖到某个特定频率值，也不需要特定的画面效果。drag 最多 2 次。',
  },
  {
    id: 'ft-sections', page: 'ftl-fourier', maxTurns: 16,
    title: '§4 三图并排与 §5 讲解渲染',
    goal: '向下滚动到 §4 "Center of mass vs frequency" 与 §5 "Geometric meaning"（页面底部，总高约 9500px，scroll 的 dy 用 800）。逐项确认，见过即算。',
    passCriteria: '三项都见过立即 done pass：①§4 三张质心图（raw / smoothed / bar）并排渲染、坐标轴与曲线可见；②§5 公式已由页内置迷你 TeX 渲染器排版（无裸露 $ 符号、无红色错误框）；③§5 末尾 "A figure makes this easier to understand:" 字样下方有一张 Canvas 实时插图（深蓝黑底：左侧青色时域波形、中间 winding 箭头、右侧复平面缠绕曲线 + 红色质心向量）——看到这张图即满足。注意：页面最大滚动位置约 8651，到底了就别再往下滚，图就在底部这一屏。',
  },

  /* ---------- ftl-laplace（ft_laplace/laplace_transform.html） ----------
     已核对控件：#funcInput #modeUni/#modeBi(radio) #winLen #sigmaMin #sigmaMax #omegaMin
     #omegaMax #tMap #btnGenerate #presetExp/#presetRing/#presetStep(button) #sigmaSlider
     #animSigma #animOmega #animPlayBtn #animFrame；canvasSignal/canvasGrid/canvasAnim/
     canvasMap/canvasSliceA/canvasSliceB/canvasFamily/canvasSpiral；§5 split 读数画在画布上。 */
  {
    id: 'lt-load', page: 'ftl-laplace', maxTurns: 6,
    title: '就绪自动出图',
    goal: '打开拉普拉斯变换交互页（英文 UI），不操作，只观察。mathjs 加载完成后自动出图（公式由页内置迷你 TeX 渲染器排版）。',
    passCriteria: '①无 "Failed to load math.js" 红色提示；②§1 "The signal and its envelope" 画布上可见三条线（信号曲线 + e^{-σt} 上下包络）；③#btnGenerate 可用。',
  },
  {
    id: 'lt-presets', page: 'ftl-laplace', maxTurns: 14,
    title: '三个信号预设依次出图',
    goal: '顶部输入面板有三个预设按钮：#presetExp "exp(-2*t) — one real pole"、#presetRing "exp(-0.5*t)*cos(2*pi*t) — a pole pair"、#presetStep "(t>=0) — a step"。依次点击这三个按钮，每次点击后等出图再点下一个。最后再点回 #presetRing，然后用 find "#canvasFamily" 直接滚到 §5（不要逐屏 scroll）。',
    passCriteria: '每次点击后输入框函数、T/σ/ω 范围与 §1 图形随之更新、无报错；§5 画布上有 T/2T/4T 三条曲线族和一条 "windows start to disagree → pole at σ ≈ X" 文字标注，其中 #presetRing 生效时 X ≈ -0.50（这是共轭极点对 s = -0.5 ± j2π 的实部；§5 只显示实部，不会出现 ±jω 字样）。',
  },
  {
    id: 'lt-sigma', page: 'ftl-laplace', maxTurns: 10,
    title: '拖动 σ 滑块',
    goal: '用 find "#sigmaSlider" 把 §1 的 σ 滑块滚进视口（滑块与 §1 包络图同屏）。向左 drag 一次、幅度大一点（起点用清单坐标，终点向左约 150 归一化单位）。只拖这一次。然后按顺序确认：①下一轮【驱动对比】会给出 "σ: 旧值 → 新值（变了）"；②同屏 §1 的 e^{-σt} 虚线包络形状改变。最后 find "#canvasMap" 滚到 §4，看热力图上的十字竖线是否在新 σ 位置。',
    passCriteria: '①【驱动对比】显示 σ 变了（drag 一次后即出现"σ: 旧 → 新（变了）"）；②同屏 §1 虚线包络形状改变。①②满足立即 done pass，§4 十字线可不看。drag 最多 2 次。',
  },
  {
    id: 'lt-map', page: 'ftl-laplace', maxTurns: 8,
    title: '§4 热力图与切片图',
    goal: '先用 find "#canvasMap" 一步跳到 §4——跳完后当前屏幕中央就是热力图本体。确认热力图后，向下 scroll 约 400（不要多）看下方两张切片图。注意页面顺序：热力图 → 切片图 → §5 "Window length family"；如果看到 §5 标题说明滚过了，用负 dy 滚回来。',
    passCriteria: '三条见过立即 done：①热力图是彩色渐变（非纯色非空白）；②两张切片图各有曲线；③热力图上有极点标记（× 或 P 字样）。',
  },
  {
    id: 'lt-family', page: 'ftl-laplace', maxTurns: 8,
    title: '§5 曲线族与 split 读数',
    goal: '用默认信号（若不确定就先点一下 #presetExp "exp(-2*t)"），滚动到 §5 "Window length family"，读画布上的 split 标注（文字形如 "windows start to disagree → pole at σ ≈ -2.00"）。',
    passCriteria: '§5 画布上有 T/2T/4T 三条曲线族，且 split 读数约为 σ ≈ -2.00（允许 -1.9 ~ -2.1 的判定误差），与 exp(-2t) 的极点位置一致。',
  },
  {
    id: 'lt-spiral', page: 'ftl-laplace', maxTurns: 8,
    title: '§6 三维螺旋拖动旋转',
    goal: '§6 "3D spiral"（#canvasSpiral）在页面约 5800px 深处（总高约 11500px），不要逐屏滚动：先用 find "#canvasSpiral" 把画布直接跳进视口，然后在画布中央按下、水平 drag 约 200px（保持在画布范围内），改变观察视角。',
    passCriteria: '拖动后螺旋的三维视角明显旋转（前后截图画面不同），无报错。',
  },
  {
    id: 'lt-prose', page: 'ftl-laplace', maxTurns: 8,
    title: '§7 讲解公式渲染',
    goal: '§7 讲解区（#section7）在页面约 6500px 深处，不要逐屏滚动：先用 find "#section7" 跳过去，最多再向下滚两屏。',
    passCriteria: '在 §7 里看到一个排版好的数学公式（积分号/分式/上下标等排版后的数学式）且没有裸露的 $ 符号和红色错误框，立即 done pass——一个实例就够，不要往下扫。',
  },

  /* ---------- fsi-index（枢纽页：四个 a.card） ---------- */
  {
    id: 'fsi-index-nav', page: 'fsi-index', maxTurns: 10,
    title: '四张卡片导航',
    goal: '这是 fs_inv_ft_inv_laplace 子项目枢纽页（英文 UI），有四张卡片，分别通向：Fourier series linear superposition、From Fourier series to Fourier transform、Fourier inverse transform synthesis、Laplace inverse transform synthesis。依次点进每张卡片，确认都能打开对应可视化页；点完一张卡确认落地后（驱动会反馈新页面 URL），用 {"action":"back"} 动作返回枢纽页，再点下一张。',
    passCriteria: '四个目标页都能打开且各自渲染出复平面/频谱/时域画布与右侧参数侧栏，无空白页、无红色错误条。',
  },

  /* ---------- fsi-fsls（傅里叶级数线性叠加） ----------
     已核对控件：#preset(select) #N(range) view 单选(name=view: oneside/double/pair)
     #play #reset #step #speed cCircles/cLabels/cTrail/cIdeal(checkbox) #loadPreset #clearCust */
  {
    id: 'fsls-preset', page: 'fsi-fsls', maxTurns: 10,
    title: '切换预设波形',
    goal: '右侧侧栏顶部有 "Preset signal" 下拉框（#preset，选项含 square wave / cosine / multi-tone / sawtooth / triangle / impulse train）。把预设从当前值切换到另一个（例如从 square 切到 sawtooth）。',
    passCriteria: '切换后下方时域波形与上方频谱随之改变（锯齿波与方波形状明显不同），无报错。',
  },
  {
    id: 'fsls-n', page: 'fsi-fsls', maxTurns: 8,
    title: '拖动谐波数 N 滑块',
    goal: '侧栏有控制谐波个数的滑块 #N（旁有读数如 N=5）。把它向右拖大（例如拖到 15 以上）。',
    passCriteria: '拖动后 N 读数变大，复平面里的旋转向量数量/频谱谱线数量明显增多，合成波形更接近理想形状。',
  },
  {
    id: 'fsls-play', page: 'fsi-fsls', maxTurns: 8,
    title: '播放/暂停',
    goal: '验证播放/暂停按钮（侧栏 #play，在 "Step" 按钮左边，点击用控件清单给的 #play 中心坐标）。页面默认正在播放（按钮 "⏸ Pause"）。注意：你思考时动画也在走，播放中两张截图画面可能差很多——正常。判定方法：相邻两张截图里复平面向量链/波形位置不同 = 播放中；完全一致 = 已暂停。流程：先确认在动；点 1 次 #play；确认下一张截图与点击前那张完全一致。',
    passCriteria: '播放中相邻截图画面不同；点击后按钮变为 "▶ Play"，且下一张截图与点击前那张完全一致。确认后立即 done pass，本项点击不超过 2 次。',
  },
  {
    id: 'fsls-view', page: 'fsi-fsls', maxTurns: 8,
    title: '频谱视图切双边',
    goal: '侧栏有一组 view 单选（name=view）：oneside / double / pair。当前是 oneside，切到 double。',
    passCriteria: '切换后频谱从单边（仅正频率）变成双边（正负频率对称显示），频谱图明显变化。',
  },
  {
    id: 'fsls-toggles', page: 'fsi-fsls', maxTurns: 12,
    title: '显示开关逐项切换',
    goal: '侧栏 DISPLAY 区有四个显示复选框：#cCircles（Orbit circles）、#cLabels（Vector labels）、#cTrail（Tip trail）、#cIdeal（Ideal waveform overlay），初始全部勾选。先点 1 次 #play 暂停动画（便于画面对比），再依次取消勾选 #cCircles、#cLabels、#cTrail，每个只点 1 次。注意：点击结果里复选框的 value 恒为 "on"，不代表勾选状态；是否切换成功以点击结果的"现在是 checked/unchecked"和【页面控件】清单为准。',
    passCriteria: '三个框依次变为 unchecked，且对应画面元素（复平面轨道圆 / 向量旁 k= 标签 / 端点轨迹线）在截图中消失。确认后立即 done pass，总点击不超过 5 次。',
  },

  /* ---------- fsi-bridge（级数→变换过渡） ----------
     已核对控件：#preset #shape #logT #autoT #omx #play #step #tsl ckEnv/ckRaw/ckBrk/ckIdeal */
  {
    id: 'bridge-logt', page: 'fsi-bridge', maxTurns: 8,
    title: '拖 logT 让谱线变密',
    goal: '侧栏有控制周期 T（对数刻度）的滑块 #logT（旁有 T 读数）。把它向右拖，增大 T。',
    passCriteria: '拖动后 T 读数增大，频谱中的谱线间距随之变密（谱线数量明显增多），演示"周期→∞ 时离散谱趋于连续"。',
  },
  {
    id: 'bridge-autot', page: 'fsi-bridge', maxTurns: 8,
    title: 'autoT 自动扫描',
    goal: '点击侧栏的 Auto T 按钮（#autoT），让 T 自动从小到大扫描，观察几秒后再点一次停止。',
    passCriteria: '点击后 T 读数自动持续增大、谱线自动变密（无需手动拖动）；再点后停止。',
  },
  {
    id: 'bridge-play', page: 'fsi-bridge', maxTurns: 8,
    title: '播放/暂停',
    goal: '验证播放/暂停按钮（侧栏 #play，在 "Step +T/128" 按钮左边，点击用控件清单给的 #play 中心坐标）。页面默认正在播放（按钮 "⏸ Pause"）。注意：你思考时动画也在走，播放中两张截图的 t 读数可能差很多——正常。判定方法：相邻两张截图的 t 读数不同 = 播放中；完全相同 = 已暂停。流程：先确认 t 在变；点 1 次 #play；确认下一张截图的 t 与点击前那张完全相同。',
    passCriteria: '播放中相邻截图 t 读数不同；点击后按钮变为 "▶ Play"，且下一张截图的 t 与点击前那张完全相同。确认后立即 done pass，本项点击不超过 2 次。',
  },

  /* ---------- fsi-ift（傅里叶反变换合成） ----------
     已核对控件：#preset #shape #logdw #omx #play #step #speed #tsl
     ckIdeal/ckEnv/ckRaw/ckLens/ckBrk/ck3d/ckFreeze */
  {
    id: 'ift-preset', page: 'fsi-ift', maxTurns: 10,
    title: '切换预设信号',
    goal: '侧栏顶部 "Preset signal" 下拉框（#preset，当前 value=dexp）。用 {"action":"select","target":"#preset","value":"rect"} 一步切成 rect（不要点击原生下拉列表，合成点击会穿透弹层误触下层控件；option 的 value 清单在控件列表的 options=[...] 里）。',
    passCriteria: '【页面控件】里 #preset 的 value 变为 rect；频谱从指数衰减形变成 sinc 形（带旁瓣），时域合成波形趋向矩形脉冲，无报错。确认后立即 done pass。',
  },
  {
    id: 'ift-play', page: 'fsi-ift', maxTurns: 8,
    title: '播放/暂停',
    goal: '验证播放/暂停按钮（侧栏 #play，注意它在 "Step +Tw/64" 按钮的左边，两个按钮相邻，点击用控件清单给的 #play 中心坐标，别点错）。页面默认正在播放。判定直接用每轮的【驱动对比】：t 标"变化了" = 播放中；t 标"未变化"且按钮文本变为 "▶ Play" = 暂停成功；t 变化且按钮为 "⏸ Pause" = 播放成功。流程：第 1 步先看【驱动实测状态】，按钮应为 "⏸ Pause"（播放中）；点 1 次 #play；下一轮【驱动对比】显示 t 未变化 + 按钮变 "▶ Play"，即验证完成。你的思考时间里动画也在走，播放中 t 跳变很大是正常的。',
    passCriteria: '【驱动对比】出现过"变化了 = 在播放"（播放正常），且点击后出现"t 未变化 + 按钮文本变为 ▶ Play"（暂停正常）。两条都满足立即 done pass，本项点击按钮不超过 2 次。',
  },
  {
    id: 'ift-3d', page: 'fsi-ift', maxTurns: 10,
    title: '3D 频谱栅栏开关与旋转',
    goal: '在侧栏勾选 "3D spectrum fence" 复选框（#ck3d），右上频谱视图应变成 3D 栅栏；然后在频谱面板内按住拖动（drag），旋转观察视角。',
    passCriteria: '①勾选后频谱面板出现立在 σ=0 平面上的 3D 栅栏柱；②拖动后视角旋转（栅栏透视变化）；③取消勾选回到 2D 谱线。',
  },
  {
    id: 'ift-lens', page: 'fsi-ift', maxTurns: 8,
    title: '放大镜开关',
    goal: '切换侧栏的 ckLens（magnifier / 放大镜）复选框：勾上再取消。',
    passCriteria: '勾上后复平面视图出现局部放大效果（链端点附近有放大圆圈/放大倍数标注）；取消后恢复。',
  },

  /* ---------- fsi-laplace（拉普拉斯反变换合成） ----------
     已核对控件：#preset(含 custom) #fexpr(text) #fexerr(错误提示区) #shape #w0 #sig #logdw
     #omx #winmul #winauto #play #step #speed #tsl ckIdeal/ckEnv/ckRaw/ckLens/ckBrk/ckFreeze */
  {
    id: 'lit-preset', page: 'fsi-laplace', maxTurns: 10,
    title: '切换预设信号',
    goal: '侧栏 "Preset signal" 下拉框（#preset，当前 sexp）。用 select 动作切成 dsin（{"action":"select","target":"#preset","value":"dsin"}），等一轮确认；然后再 select 回 sexp 一次。完成后立即 done——【最近动作】里出现过 dsin 成功 + sexp 成功各一次就是完成，绝对不要重复切换。总共最多 3 次 select。',
    passCriteria: '【最近动作】里 select dsin 返回 "ok value=dsin" 且 select sexp 返回 "ok value=sexp"（各一次）即通过，立即 done。',
  },
  {
    id: 'lit-custom-ok', page: 'fsi-laplace', maxTurns: 12,
    title: '自定义合法表达式出图',
    goal: '先用 select 动作把 #preset 切到 custom（value="custom"），侧栏会出现函数表达式输入框 #fexpr（切之前它 display:none，find 会报不可见，这是预期）。然后用 type 动作在 #fexpr 输入 exp(-a*t)*cos(w0*t)*u(t)（故意用 cos 而不是默认的 sin——输相同文本不触发重解析；cos 版波形从 1 起跳可与默认区分），按 Enter。',
    passCriteria: '#fexerr 无报错文本；时域合成波形变为 cos 形（t=0 从 1 起振），画布正常出图。',
  },
  {
    id: 'lit-custom-bad', page: 'fsi-laplace', maxTurns: 10,
    title: '非法表达式报错并保留旧信号',
    goal: '先用 select 动作把 #preset 切到 custom（输入框 #fexpr 只在 custom 下出现，切之前 find 它会报不可见——预期）。切过去后用 type 动作把 #fexpr 改成非法表达式：只输入 4 个字符 exp(（字母 e、x、p 和一个左括号），**不要输入完整表达式**。然后按 Enter。',
    passCriteria: '①#fexpr 旁的 #fexerr 元素出现英文错误文本（可用 find "#fexerr" 或看截图确认）；②无全页红色崩溃条；③画布保留上一个可用信号的图形。确认后立即 done。',
  },
  {
    id: 'lit-sigma', page: 'fsi-laplace', maxTurns: 8,
    title: '拖 σ 滑块移动 ROC',
    goal: '拖动侧栏的 σ 滑块（#sig，旁有读数）一次——幅度任意，向左向右都行，不要追求拖到某个特定数值。',
    passCriteria: '①【驱动对比】显示 "σ: 旧值 → 新值（变了）"；②右上 3D s 平面面板里的柱阵/标注有可见变化。两条满足立即 done。本项 drag 最多 2 次。注意：ROC 绿带和极点本身不动，它们由预设决定——不要等绿带移动。',
  },
  {
    id: 'lit-play', page: 'fsi-laplace', maxTurns: 8,
    title: '播放/暂停',
    goal: '验证播放/暂停按钮（侧栏 #play，在 "Step +Tw/64" 按钮左边，点击用控件清单给的 #play 中心坐标）。页面默认正在播放（按钮 "⏸ Pause"）。注意：你思考时动画也在走，播放中两张截图的 t 读数可能差很多——正常。判定方法：相邻两张截图的 t 读数不同 = 播放中；完全相同 = 已暂停。流程：先确认 t 在变；点 1 次 #play；确认下一张截图的 t 与点击前那张完全相同。',
    passCriteria: '播放中相邻截图 t 读数不同；点击后按钮变为 "▶ Play"，且下一张截图的 t 与点击前那张完全相同。确认后立即 done pass，本项点击不超过 2 次。',
  },
];
