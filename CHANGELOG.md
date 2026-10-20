# Changelog

All notable changes to dsh-livedocs. Format follows [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/);
versioning follows [SemVer](https://semver.org/lang/zh-CN/).

## [0.2.2] - 2026-10-20

### Changed

- 适配 DSH 0.2.1-rc.1+ 插件兼容性检查新契约：在 `package.json` 的 `engines` 中声明 `dsh: ">=0.2.0-rc.1 <0.3.0"`（该字段优先于 `peerDependencies` 被 Host 读取），同时保留 `peerDependencies` 作兼容回退。

## [0.2.1] - 2026-10-20

### Fixed

- 修正 DSH 0.2.x 下的设置卡片槽位：从 `plugins.item` 改为 `plugins.row.config`（键 `dsh-livedocs#livedocs`），
  通过 `configForms` 的 `form` prop 读写配置，避免在 0.2.x Host 上因槽位/服务不匹配导致插件加载失败。
- 恢复对 DSH 0.1.x 的向后兼容：当 Host 仍提供 `settingsScope` 服务时，继续使用旧版 `settings.plugin.item` 卡片。
- 修复 `Config` schema 在旧版 schemastery 上调用 `.volatile()` 会丢失默认值的问题；改为运行时探测并跳过有缺陷的旧实现。
- 重新启用插件侧配置变更监听（缓存 TTL、skill 注册、`/livedocs` 命令本地化），支持 0.2.x `internal/config` 事件与 0.1.x settings watch 双路径。

## [0.2.0] - 2026-10-13

迁移到 DSH 0.2.x 插件契约。**破坏性变更：要求 DSH ≥ 0.2.0-rc.1；0.1.x 用户请停留在 0.1.9。**

### Changed

- Host 侧：导出 `Config`（schemastery schema），cordis 校验用户设置并把解析结果传入 `apply(ctx, config)`；
  移除客户端 settings 服务注册与全部插件侧 watch（0.2.x 删除了 `settingsScope` 服务）
- Client 侧：`settingsScope` → `configForms` 服务（`get` / `whileServed`）；设置卡片槽位
  `settings.plugin.item` → `plugins.row.config`（键 `dsh-livedocs#livedocs`）
- 保留 0.1.x 路径作向后兼容：`ctx.inject(['settingsScope'])` 仅在旧 Host 存在该服务时注册旧卡片
- 校验内化为 schema：customDocs 仅接受 `https://` URL、Context7 Key 仅接受 `ctx7sk` 前缀（`.pattern()`）；
  Key 字段 `.role('secret')`（settings wire 自动脱敏）
- 依赖对齐：`@deepseek-ai/dsh-tools` / `@deepseek-ai/dsh-typert-protocol` ^0.2.0-rc.2

## [0.1.9] - 2026-10-08

### Added

- 适配 DSH 0.1.7+ 插件管理契约：设置订阅随插件实例销毁（运行时启停/卸载无泄漏）；
  `peerDependencies` 声明 DSH 兼容范围（安装与启动时校验）；插件管理页多语言标题/描述（`locale/*.json`）+ 图标

## [0.1.8] - 2026-09-15

### Added

- `/livedocs` 命令随界面语言切换重新注册本地化描述/提示
- README 设置卡片截图更新（中英对照）

## [0.1.7] - 2026-09-15

### Added

- 设置卡片中英双语切换（`locale: zh/en`，默认中文，即时生效）

## [0.1.6] - 2026-09-15

### Removed

- 移除 `/docs` 别名（看起来像宿主内置命令），只保留 `/livedocs`

## [0.1.5] - 2026-09-15

### Changed

- 命令描述改为中文一句话风格，与内置命令一致

## [0.1.4] - 2026-09-15

### Changed

- 斜杠命令更名 `/docs` → `/livedocs`（保留 `/docs` 别名过渡）

## [0.1.3] - 2026-09-15

### Added

- 设置卡片「检查更新」：Host 侧对比 npm registry 最新发布，发现新版本时给出升级命令

## [0.1.2] - 2026-09-12

### Fixed

- MIT LICENSE 文件随 npm 包发布（市场提交要求）

## [0.1.1] - 2026-09-11

### Added

- 首个 npm 公开发布：`npm i dsh-livedocs`；README 增加安装命令与 npm badge

## [0.1.0] - 2026-09-10

首个可用版本（未发布到 npm）。

### Added

- 三工具：`docs_resolve` / `docs_query` / `docs_cache`；多源降级（llms.txt → GitHub README）+ 本地缓存（7 天 TTL）
- 读项目 node_modules / lockfile 自动钉版本；`docs_setup` 规则幂等注入 AGENTS.md（项目/全局）
- `/docs` 斜杠命令；版本不一致警告；topic 零命中回退到概览
- 依赖上下文注入（每会话向模型展示项目依赖及安装版本）+ Top N 依赖文档后台预热
- 设置卡片（设置 → 插件 → 插件配置）：总开关、注入/预热开关、预热 Top N、缓存 TTL 与上限、
  自定义文档源、缓存列表查看/移除/清空（二次确认）；项目级 `.dsh-livedocs.json` 覆盖
- 策展注册表（50+ 主流库 verified llms.txt 直连）+ 预热失败不占名额；缓存迁至 `~/.dsh/livedocs/`（跨 profile 共享）
- 可选 Context7 云端索引兜底（默认关闭；Key 仅全局设置，项目文件不可覆盖）
- 嵌入式 skill 自动触发（宿主技能目录注册 `livedocs` 技能，目录常驻、正文按需加载）

### Fixed

- remote 命名空间 RemoteResult 信封解包；缓存存储避开 proxy #private 字段；
  拒绝把 HTML 页面当文档；仓库 URL 去掉 fragment

[0.2.2]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.9...v0.2.0
[0.1.9]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/sogoodayo/dsh-livedocs/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/sogoodayo/dsh-livedocs/releases/tag/v0.1.1
[0.1.0]: https://github.com/sogoodayo/dsh-livedocs/tree/v0.1.1
