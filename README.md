# 信号与系统 · 傅里叶 / 拉普拉斯可视化

两套零构建的静态交互可视化页面，合并存放在同一个仓库中，共用一个总览入口页。

## 入口

| 子目录 | 内容 | 入口 |
| --- | --- | --- |
| `ft_laplace/` | 傅里叶变换（缠绕机 / 质心法）与拉普拉斯变换（σ 包络、极点、收敛域），另有 Python notebook 版 | [`ft_laplace/index.html`](ft_laplace/index.html) |
| `fs_inv_ft_inv_laplace/` | 傅里叶级数线性叠加、从级数到变换的过渡、傅里叶反变换合成、拉普拉斯反变换合成 | [`fs_inv_ft_inv_laplace/index.html`](fs_inv_ft_inv_laplace/index.html) |

根目录的 `index.html` 是总览页，两张卡片分别指向上面两个入口。

**任意页面左侧都有一个抽屉式侧边栏**（2026-09-26 加入）：鼠标悬停或点击左上角的 `≡` 图标即滑出，面板里按目录树列出全站所有页面（含 notebook），点一下直达，不必再从根页一层层点进子站枢纽页。

## 目录结构

```
index.html                  总览页（两套可视化的一站式入口）
fourier_transform.html      旧地址跳转页 → ft_laplace/fourier_transform.html
laplace_transform.html      旧地址跳转页 → ft_laplace/laplace_transform.html
.nojekyll                   关闭 GitHub Pages 的 Jekyll 处理
assets/drawer.css|drawer.js 全站共用的抽屉导航（样式 + 清单与交互，2026-09-26 新增）
ft_laplace/                 子项目一（原独立仓库）
fs_inv_ft_inv_laplace/      子项目二（原独立仓库）
tools/visual_qa/            全站截图与视觉巡检工具（Node + 本机 Chrome，零 npm 依赖）
```

两个子目录内部的文件、相对路径与页面跳转均未改动，各自的结构说明见其自身的 `README.md` / `AGENTS.md`。唯一的跨目录引用是那 9 个页面各自指向仓库根 `assets/` 的抽屉导航（一行 `<link>` + 一行 `<script>`，相对路径），代价是 `fs_inv_ft_inv_laplace/` 不能再整目录拷出去独立使用（那样只是抽屉 404，页面本身仍能跑）。

## 本地运行

纯静态，无构建步骤：

- 直接双击根目录 `index.html` 开始浏览——卡片链接都指向具体的 `index.html`，所以在 `file://` 下也能一层层点进去；或
- 在本目录启动静态服务器，例如 `python -m http.server`，再访问 `http://localhost:8000/`。

子项目二自带开发验证脚本（需要 Node.js 与本机 Chrome/Chromium）：

```
node fs_inv_ft_inv_laplace/tools/check.js
```

另有一套全站截图与视觉巡检工具（同样需要 Node.js 与本机 Chrome；视觉巡检另需 DashScope API Key）：

```
node tools/visual_qa/selftest.js    # 11 页 smoke
node tools/visual_qa/shot.js        # 全页/分段截图 → tools/visual_qa/out/shots/
node tools/visual_qa/agent.js       # Qwen 视觉巡检（用法见 tools/visual_qa/README.md）
```

## 部署

GitHub Pages：`Deploy from a branch` → `main` → `/ (root)`。站点全部使用相对路径，因此总览页与两个子站能在同一域名下的不同子路径中正常工作。

两个旧地址（`/fourier_transform.html`、`/laplace_transform.html`）由根目录的同名跳转页接管，已有的书签与外链不会失效。

## 新增可视化

新建一个子目录放页面，再在根 `index.html` 的卡片区加一张卡片即可。子项目之间互不依赖，也不需要改动已有的任何一页。抽屉导航的清单是独立的一份——新页面要出现在侧边栏里，需在 `assets/drawer.js` 顶部的 `NAV` 表加一条，并给该页加上那一行 `<link>` 与一行 `<script>`。

## 版本历史

本仓库由两个各自独立的 Git 仓库合并而成：

- `ft_laplace/` 的内容来自原仓库 `xidianhush/Fourier_Series_and_Fourier_Transform_and_Laplace_Transform_Visualization`；
- `fs_inv_ft_inv_laplace/` 的内容来自另一个独立的本地仓库。

合并采用「保留历史 + 子目录隔离」方式：两个仓库的每条提交都原样保留（**已有提交的 SHA 没有发生变化**），各自多出一个「把文件移进子目录」的提交，再由一个合并提交把两条历史汇合。合并前的状态由 `pre-merge` 标签标记，可随时回退。

## 许可

`fs_inv_ft_inv_laplace/` 下的页面为 MIT 许可，见该目录内的 `LICENSE`；`ft_laplace/` 目录未附带许可文件。仓库根目录暂无 `LICENSE`。
