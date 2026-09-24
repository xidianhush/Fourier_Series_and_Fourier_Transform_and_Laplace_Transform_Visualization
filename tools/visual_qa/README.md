# tools/visual_qa — 全站截图与视觉巡检工具

零 npm 依赖的浏览器驱动与视觉巡检工具（只用 Node 内置模块）。两个用途：

1. **全站排版截图审查**（`shot.js`）：对仓库全部 11 个页面批量截图，供人工或视觉模型审查排版。
2. **Qwen 视觉模型驱动的功能巡检**（`agent.js`）：模型看截图 → 给出动作 → 驱动执行 → 再截图循环判断，直到给出 pass/fail 结论。

## 依赖

- **Node.js ≥ 22**（用内置的全局 `WebSocket` / `fetch`，实测 v24）；
- **本机 Chrome / Chromium / Edge**（路径用环境变量 `CHROME` 覆盖，缺省按常见安装路径探测）；
- 视觉巡检（`agent.js` 真跑）另需 **DashScope（阿里云百炼）API Key**；`selftest.js` / `shot.js` / `--dry-run` 不耗 API。

## 文件说明

| 文件 | 用途 |
| --- | --- |
| `cdp.js` | 极简 CDP（Chrome DevTools Protocol）客户端：启动 Chrome、开页、导航、截图、点击/输入/拖动 |
| `readiness.js` | 页面清单 `PAGES`（11 页）+ 三档就绪等待（CDN 页等 mathjs/KaTeX、可视化页等 `__VIZ`、跳转页等 meta refresh 跳完），三方共用 |
| `shot.js` | 批量截图：整页 + 纵切切片 + 语义分段 |
| `selftest.js` | 不耗 API 的 smoke 自检：导航、就绪等待、canvas 存在、点击/拖动、console 错误 |
| `qwen.js` | DashScope（OpenAI 兼容模式）视觉模型客户端 + 动作 JSON 解析 |
| `checklist.js` | 32 个巡检功能点（目标 + 通过标准） |
| `agent.js` | 巡检循环：截图 → 问模型 → 执行动作 → 安全栏检查 → 汇总报告 |

## 用法

```bash
node tools/visual_qa/selftest.js [key ...]            # 11 页 smoke，不耗 API
node tools/visual_qa/shot.js [key ...] [--narrow]     # 截图 → tools/visual_qa/out/shots/
node tools/visual_qa/agent.js --list                  # 列出巡检项
node tools/visual_qa/agent.js [itemId|pageKey ...] --dry-run   # 不耗 API，打印首轮 prompt
DASHSCOPE_API_KEY=sk-... node tools/visual_qa/agent.js         # 真跑（Git Bash 写法）
```

页面 key 清单（`[key ...]` 参数、`readiness.js` 的 `PAGES`）：

`root`、`redir-fourier`、`redir-laplace`、`ftl-index`、`ftl-fourier`、`ftl-laplace`、`fsi-index`、`fsi-fsls`、`fsi-bridge`、`fsi-ift`、`fsi-laplace`。

`agent.js` 的位置参数既可以是单个巡检项 id，也可以是页面 key（选中该页全部巡检项）；`--list` 可查看 id 清单。`--narrow` 用 800px 窄视口截图，查窄屏溢出。

## 模型与密钥

- 默认模型 `qwen3-vl-flash`，用环境变量 `QWEN_MODEL` 或 `--model` 参数覆盖；
- API Key 只从环境变量 `DASHSCOPE_API_KEY` 读取，不写入任何文件。

## 安全栏

- 动作执行后校验当前 URL，**只允许停留在仓库内的 `file://` 页面**，越界即判 fail 并中止该巡检项；
- `--max-calls`（默认 200）封顶全程 API 调用次数；
- `--max-turns`（默认 12）封顶单个功能点的轮数。

## 动作协议

模型每轮回复一个 JSON 动作对象（`click` / `type` / `key` / `scroll` / `drag` / `find` / `done`），坐标为 0–1000 归一化，由驱动换算成视口像素执行；`find` 按选择器把屏外控件 `scrollIntoView`（含侧栏内部滚动）并返回新中心坐标。

驱动的可靠性增强（调试 qwen3-vl-flash 实测后加入）：每轮向模型注入【驱动实测状态】（播放按钮文本、t 滑块值、`__VIZ.st.t`、滚动位置）与【驱动对比】（相邻两轮差分结论）；点击结果带"命中元素"反馈；坐标越界（不在 0–1000）拒绝执行并重问；同一位置连点 3 次注入刹车警告。

## 产物与退出码

产物写在 `tools/visual_qa/out/`（已被 `.gitignore` 排除）：截图（`out/shots/`、`out/selftest/`）、每个巡检项的 `transcript.json` 与逐轮截图（`out/qa/<itemId>/`）、汇总 `out/qa/report.json`。任一巡检项 fail 时进程退出码为 1。
