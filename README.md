# dsh-livedocs

Version-pinned live library docs for **DeepSeek Harness (DSH)** — kill hallucinated APIs.

在 agent 写代码前，拉取**版本对应**的官方文档注入上下文：llms.txt 优先、GitHub tag 文档兜底、本地缓存离线可用、token 预算可控。零 API Key、零原生依赖。

## 安装

```bash
dsh plugin --profile web add github:your-account/dsh-livedocs
```

## 工具

| 工具 | 说明 |
|---|---|
| `docs_resolve` | 库名 → 文档源（文档站 llms.txt、GitHub 仓库、最新版本） |
| `docs_query` | 拉取版本对应的文档片段，按 topic 检索、按 token 预算裁剪，7 天本地缓存；传 `projectDir` 自动钉项目里安装的版本 |
| `docs_cache` | 缓存统计 / 清理 |
| `docs_setup` | 把使用规则幂等写入项目 AGENTS.md，让 agent 主动查文档 |

## 工作原理

```
库名 → npm registry 元数据（版本 / 仓库 / 文档站）
     → 版本钉选：显式 version > node_modules / lockfile 实测 > 最新 release
     → 降级链拉取：llms-full.txt → llms.txt → GitHub README（按 tag 钉版本）
     → Markdown 按标题分块 → topic 打分 → token 预算内裁剪
     → JSON 文件 LRU 缓存（断网时返回过期缓存并标注 stale）
```

## 推荐搭配规则

在项目里跑一次 `docs_setup` 即可自动写入；手动配置则在 AGENTS.md（或 agent preset）中加一条：

```text
Always call docs_query before writing code against any third-party library API.
Never rely on training data for framework APIs (Next.js, React, Vue, etc.).
```

## 路线图

- [x] M1：三工具 + 多源降级 + 缓存
- [x] M2：读项目 node_modules / lockfile 自动钉版本；`docs_setup` 规则幂等注入 AGENTS.md
- [ ] M3：设置页（缓存 TTL、token 预算、可选 Context7 后端 Key）
- [ ] M4：项目打开时后台预热 Top N 依赖文档

## 兼容性

已在 DSH Developer Preview（web profile）的插件契约下开发：`inject: ['tools']` + `defineTool`（`@deepseek-ai/dsh-tools`）。DSH 处于预览期，若宿主升级导致 inject 契约变化，请提 issue。

设计与调研依据见 [docs/feasibility.md](docs/feasibility.md)。

## License

MIT
