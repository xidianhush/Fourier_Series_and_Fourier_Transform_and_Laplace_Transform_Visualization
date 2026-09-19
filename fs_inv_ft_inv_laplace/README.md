# 信号与系统 · 傅里叶 / 拉普拉斯可视化合集

四个单页交互可视化，主线是"信号 = 复指数信号的线性组合"：

| 页面 | 内容 |
| --- | --- |
| `Fourier_series_linear_superposition.html` | 周期信号的傅里叶级数：谐波关系的复指数信号线性叠加 |
| `From_Fourier_series_to_Fourier_transform.html` | T→∞ 时谱线变密、系数变矮，离散和过渡为傅里叶积分 |
| `Fourier_inverse_transform_synthesis.html` | 非周期信号的傅里叶反变换：遍布 ω 轴的 e^{jωt} 加权积分（黎曼和向量链） |
| `Laplace_inverse_transform_synthesis.html` | 拉普拉斯反变换：基为 e^{(σ+jω)t}、权重为 X(σ+jω) 的合成 |

每页布局相同：上方复平面（旋转伸缩向量链首尾相接，端点 = 合成信号）与频谱视图，
下方时域视图（向量链在实轴上的投影随 t 变化）；右侧侧栏为参数与开关。

## 本地运行

纯静态站点，无构建步骤：

- 直接双击 `index.html` 用浏览器打开；或
- 以本目录为静态根启动服务器，例如 `python -m http.server`，访问 `http://localhost:8000/`。

## 目录结构

```
index.html                 枢纽页（四张卡片 + 本地运行说明）
Fourier_*.html / From_*.html / Laplace_*.html   四个可视化页（薄壳：结构 + 外链资源）
assets/common.css          共享样式（四页公共样式块 + 无障碍/错误条样式）
assets/common.js           共享工具（配色、格式化、Pointer Events 绑定、错误横幅）
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

脚本依次执行：各 `assets/*.js` 的 `node --check`；在桩 DOM 中加载 `common.js`+`ift.js`
并断言黎曼和数学性质（链端点 = 精确 f(t) 等）；对四个页面注入探针后用无头 Chrome
`--dump-dom` 确认无脚本错误；对傅里叶反变换页截图做像素扫描（时域曲线、频谱谱线、
轴标签确实画出来了）。Chrome 路径可用环境变量 `CHROME` 覆盖。

## 发布到 GitHub Pages

1. 在 GitHub 新建一个公开仓库，把本目录推送上去（`git init && git add -A && git commit && git remote add origin … && git push -u origin main`）。
2. 仓库 Settings → Pages → Source 选 `Deploy from a branch`，branch 选 `main`、目录选 `/ (root)`，Save。
3. 稍等片刻，Settings → Pages 顶部给出站点 URL（`https://<用户名>.github.io/<仓库名>/`），枢纽页即 `index.html`。

站点全部为相对路径引用，部署在任意子路径下均可工作。

## 浏览器支持

需要支持 Canvas 2D 与 Pointer Events 的现代浏览器：Chrome / Edge ≥ 88、Firefox ≥ 85、Safari ≥ 14。
尊重 `prefers-reduced-motion`：系统开启"减少动态效果"时页面默认暂停动画，可手动播放。

## 许可

MIT，见 `LICENSE`。
