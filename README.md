# dsh-livedocs

Version-pinned live library docs for **DeepSeek Harness (DSH)** — kill hallucinated APIs.

在 agent 写代码前，拉取**版本对应**的官方文档注入上下文：llms.txt 优先、GitHub tag 文档兜底、本地缓存离线可用、token 预算可控。零 API Key、零原生依赖。

## 安装

```bash
dsh plugin --profile web add github:your-account/dsh-livedocs
```

## 用法

三种方式，按无感程度排列：

**1. 斜杠命令（手动，最直接）**——在输入框敲 `/` 即可看到：

```
/docs react hooks
/docs next routing
```

结果直接渲染在会话里，**不消耗模型 token**。

**2. 全局自动规则（推荐，装一次处处生效）**——让 agent 跑一次：

```
用 docs_setup 装一下全局规则（scope 传 global）
```

规则写入 `~/.dsh/AGENTS.md`，DSH 内置的指令组件会把它注入**所有项目的所有会话**，agent 写第三方库代码前会主动先查文档。

**3. 模型自动选择**——工具描述中已内置"写第三方库代码前必须先查"的引导，模型在编码任务中会自行调用。

## 工具

| 工具 | 说明 |
|---|---|
| `docs_resolve` | 库名 → 文档源（文档站 llms.txt、GitHub 仓库、最新版本） |
| `docs_query` | 拉取版本对应的文档片段，按 topic 检索、按 token 预算裁剪，7 天本地缓存；传 `projectDir` 自动钉项目里安装的版本 |
| `docs_cache` | 缓存统计 / 清理 |
| `docs_setup` | 把使用规则幂等写入 AGENTS.md（`scope: project` 项目级 / `scope: global` 全局） |

## 工作原理

```
库名 → npm registry 元数据（版本 / 仓库 / 文档站）
     → 版本钉选：显式 version > node_modules / lockfile 实测 > 最新 release
     → 拉取链：llms-full.txt → llms.txt → GitHub README（按 tag 钉版本）
     → 版本不一致时输出显式警告（llms.txt 永远是最新版的文档）
     → Markdown 按标题分块 → topic 打分（零命中自动回退概览）→ token 预算内裁剪
     → JSON 文件 LRU 缓存（断网时返回过期缓存并标注 stale）
```

## 手动规则（可选）

不想跑 `docs_setup` 的话，手动在 AGENTS.md 中加一条：

```text
Always call docs_query before writing code against any third-party library API.
Never rely on training data for framework APIs (Next.js, React, Vue, etc.).
```

## 路线图

- [x] M1：三工具 + 多源降级 + 缓存
- [x] M2：读项目 node_modules / lockfile 自动钉版本；`docs_setup` 规则幂等注入 AGENTS.md
- [x] M2.5：`/docs` 斜杠命令；全局规则；版本不一致警告；topic 零命中回退
- [x] M2.6：依赖上下文注入（每会话自动向模型展示项目依赖及安装版本）+ Top 3 依赖文档后台预热
- [x] M3：设置卡片（设置 → 插件 → 插件配置 → Live Docs）：总开关、注入/预热开关、预热 Top N、缓存 TTL、自定义文档源（customDocs）、缓存列表查看/移除/清空；项目级 `.dsh-livedocs.json` 覆盖
- [ ] M4：可选 Context7 后端 Key；嵌入式 skill 自动触发

## 兼容性

已在 DSH Developer Preview（web profile）的插件契约下开发：`inject: ['tools']` + `defineTool`（`@deepseek-ai/dsh-tools`）。DSH 处于预览期，若宿主升级导致 inject 契约变化，请提 issue。

设计与调研依据见 [docs/feasibility.md](docs/feasibility.md)。

## License

MIT
