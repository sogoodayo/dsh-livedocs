# dsh-livedocs 可行性调研与设计方案

> 目标：为 DeepSeek Harness（DSH）做一个「实时文档」插件，让 agent 在写代码前拉到**版本对应**的官方文档，消灭幻觉 API。
> 对标：Claude Code 生态装机量第一的 Context7（约 34.8 万装机）。
> 状态：调研完成，脚手架已就绪，M1 可开发。

---

## 1. 机会判断

| 维度 | 结论 |
|---|---|
| 痛点强度 | ★★★★★ DeepSeek 系列模型训练数据对新框架（React 19、Next.js 16、Vercel AI SDK、LangChain 新版）天然滞后，幻觉 API 是编码 agent 最高频错误类别 |
| DSH 生态现状 | ❌ 空白。awesome-dsh-plugin（1.3 万+ 收录）与 cordis.run 目录中均无同类；现有 dsh-web-search-pro 是通用网页搜索，不做版本感知与文档结构化 |
| 竞争壁垒 | 中等。Context7 后端（爬取/解析/索引）是私有的，但其数据来源于公开仓库文档；llms.txt 标准普及后，自建拉取管线成本大幅下降 |
| 窗口期 | 好。DSH 官方正在推插件市场聚合，现在上架有流量红利；且生态缺高质量插件，工程严谨的插件容易脱颖而出 |

## 2. 数据源方案（核心决策）

### 方案 A：直接包 Context7（不推荐作为唯一依赖）

Context7 暴露两个 MCP 工具：`resolve-library-id`（库名 → Context7 ID）和 `query-docs`（ID + query → 文档片段，默认 5000 token），也有 REST 端点。问题：

- 免费额度有限，高频使用需要 API Key（context7.com/dashboard 申请）
- 解析/爬取后端私有，服务可用性、ToS 不受控
- 只做转发 = 没有差异化，用户为什么不直接挂 MCP？

**结论：Context7 只作为降级链中的一环（可选后端），不作为核心。**

### 方案 B：自建多源拉取管线（推荐）

```
库名解析（resolve）
  ├─ npm registry / PyPI / crates.io 元数据 → 仓库地址、文档站、当前版本
  └─ 项目 lockfile（package.json / pnpm-lock.yaml）→ 钉选版本

文档拉取（fetch，按优先级降级）
  1. 文档站 llms.txt / llms-full.txt   ← 覆盖率快速上升，专为 LLM 设计，最省 token
  2. GitHub 仓库 docs/ 目录 + README（按 tag 拉取 = 天然版本对应）
  3. Context7 REST（可选，需 Key）
  4. 通用网页抓取兜底

检索与裁剪（query）
  └─ 按 Markdown 标题分块 → topic 关键词打分 → token 预算内截断
```

优势：零外部强依赖、离线可缓存、版本钉选精准（Context7 只能匹配它索引过的版本）、有差异化叙事。

## 3. DSH 接入点（已核实的官方契约）

依据官方 Discussion #961（实战踩坑全记录）与官方开发文档：

- **插件形态**：纯 ESM 免构建，`index.js` 导出 `name` / `inject` / `apply(ctx)`
- **依赖注入**：`export const inject = ['tools']`，等工具注册表就绪后再执行 `apply`
- **工具注册**：`defineTool` 从 `@deepseek-ai/dsh-tools` 导入；`parameters` 推断并校验入参；`output.schema` 校验返回值；`output.render` 把返回值变成模型看到的内容
- **坑 1**：object 类型的 output schema 必须写 `additionalProperties: true`，否则注册直接失败
- **坑 2**：字符串参数用 `enum` 约束取值；可选参数省略 `required` 即可
- **打包**：`package.json` 里 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，`files` 字段必须包含 `cordis.patch.yml`
- **安装**：`dsh plugin --profile web add github:<账号>/<仓库>`
- **风险**：DSH 仍是 Developer Preview，0.1.2-alpha 期间 inject 契约和网关 wire 布局都变过（见 Discussion #5120），发布时需钉兼容版本并在 README 声明

## 4. 工具设计（M1 范围）

| 工具 | 入参 | 行为 |
|---|---|---|
| `docs_resolve` | `libraryName`, `query?` | 库名 → 文档源候选列表（含版本、来源类型、置信度），结果写缓存 |
| `docs_query` | `library`, `topic?`, `tokens?`(默认 4000), `version?` | 拉取 + 检索 + 裁剪文档片段，走缓存，按降级链兜底 |
| `docs_cache` | `action: enum['stats','clear']` | 缓存统计与清理（管理面） |

后续里程碑：

- **M2 版本钉选自动化**（✅ 已完成）：`lib/lockfile.js` 按 node_modules → package-lock.json → pnpm store → package.json range 的顺序检测安装版本；`docs_query` 版本优先级为 显式参数 > 项目实测 > 最新 release；`docs_setup` 工具把使用规则幂等写入项目 AGENTS.md（含重复块去重）
- **M3 设置页**：API Key（可选 Context7 后端）、缓存 TTL、token 预算默认值，走 `ctx.settings.installSection`
- **M4 预热**：装插件时/项目打开时后台预拉 Top N 依赖文档

## 5. 缓存策略

- 存储：JSON 文件 LRU（插件目录 `data/cache/`），**零原生依赖**（不用 SQLite，避免 better-sqlite3 编译问题）
- Key：`sourceUrl + version`，TTL 默认 7 天（文档更新慢，TTL 可以激进）
- 容量：默认 200 条 / 100 MB 上限，LRU 淘汰
- 离线：网络失败时命中过期缓存也返回，标注 `stale: true`

## 6. 风险清单

| 风险 | 等级 | 缓解 |
|---|---|---|
| DSH 插件 API 在 Developer Preview 期间变动 | 高 | 钉 `dsh.bundle` 兼容版本；README 声明已验证版本；核心逻辑与 DSH 适配层分离（lib/ 纯 Node 可单测） |
| llms.txt 覆盖率不足 | 中 | 多级降级链；GitHub docs/ 目录兜底已能覆盖绝大多数主流库 |
| Context7 ToS / 速率限制 | 低 | 仅作可选后端，默认关闭 |
| 文档内容的提示注入 | 低-中 | 拉取内容只进工具结果不进系统提示；render 时包裹显式边界标记 |

## 7. 差异化叙事（上架文案要点）

1. **版本钉选**：读 lockfile 给的就是你项目里那个版本的文档，不是"最新版"
2. **零配置零 Key**：默认管线不需要任何 API Key
3. **离线可用**：缓存命中即返回，断网也能工作
4. **token 预算可控**：每次注入多少文档由你定，不设上限地塞上下文是反面模式
