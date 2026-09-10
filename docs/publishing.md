# dsh-livedocs 发布清单

> 仓库已本地初始化并完成首个提交（`4bd5523`）。以下步骤按顺序执行，标注 👤 的需要你本人操作（GitHub 账号 / 登录）。

## 一、推到 GitHub

```bash
cd dsh-livedocs

# 👤 方式 A：gh CLI（已登录的话一条命令建仓+推送）
gh repo create dsh-livedocs --public --source=. --push \
  --description "Version-pinned live library docs for DeepSeek Harness — kill hallucinated APIs"

# 👤 方式 B：网页建仓后手动关联
git remote add origin git@github.com:<你的账号>/dsh-livedocs.git
git push -u origin main
```

建仓后立即打话题标签（可发现性的关键，awesome 列表和市场靠它自动收录）：

```bash
gh repo edit --add-topic dsh-plugin --add-topic deepseek-harness --add-topic llms-txt
```

或在网页端 Settings → Topics 添加：`dsh-plugin`、`deepseek-harness`、`llms-txt`、`agent-docs`。

## 二、真实环境验证（发布前必做）

⚠️ 本地冒烟已全过，但 **DSH 仍在 Developer Preview**，inject 契约可能变动，必须在真实宿主里验证：

```bash
# 在本机装好 DSH 后
dsh plugin --profile web add github:<你的账号>/dsh-livedocs
dsh web
```

验收三步（参照官方「第一个插件」教程的验收逻辑）：

1. 终端出现 `dsh-livedocs loaded` 日志 → 加载关 ✅
2. 对话中显式要求「用 docs_query 查一下 react 18 的 hooks 文档」→ 出现 tool call 且返回版本钉选结果 → 注册关 ✅
3. 在一个真实项目里不提版本直接问 → 返回中 `version from: node_modules` → 钉选关 ✅

验证通过后，把实测过的 DSH 版本号写进 README「兼容性」一节（如 `dsh >= 0.1.2`）。

## 三、上架插件市场

| 渠道 | 方式 | 说明 |
|---|---|---|
| **官方聚合市场**（deepseekharnessmarket.site） | 👤 GitHub 登录后提交仓库地址 | README 顶部可放元数据块（名称/版本/标签/图标/兼容版本/截图），具体格式以网站提交页为准；建议先在 README 顶部补齐这些信息 |
| **cordis.run** | 👤 提交插件页面 | 会跑安全扫描，结果展示在插件页；我们的零依赖、纯 ESM 设计是加分项 |
| **awesome-dsh-plugin** | 👤 提 PR 到 `awesome-dsh-plugin/awesome-dsh-plugin` | 在社区精选列表里占一个位置，带一句话简介 |
| **DSH 插件市场 Discussion #3858** | 👤 在讨论帖下发仓库地址 | 管理员可手动上架，等待认领 |

建议顺序：先官方聚合市场（流量最大），再 awesome 列表（长尾曝光）。

## 四、上架文案（可直接用）

**一句话**：让 DSH 在写代码前拉到版本对应的官方文档——llms.txt 优先、lockfile 自动钉版本、离线缓存可用，零配置零 Key。

**差异化要点**（对标 Context7）：
1. 版本钉选：读项目 lockfile，给的就是你项目里那个版本的文档
2. 零配置零 API Key：默认管线无任何外部强依赖
3. 离线可用：7 天本地缓存，断网返回过期缓存并标注
4. token 预算可控：每次注入多少文档由你定

**README 待补**：截图（真实 DSH 里的一次 docs_query 调用）、元数据块、兼容性徽章。

## 五、发布后

- 打 tag：`git tag v0.1.0 && git push --tags`，让 `dsh plugin add` 可以钉版本安装
- 观察 Discussion / issue，DSH 升级后第一时间验证兼容性（历史上 0.1.2-alpha 变更过 inject 契约）
- M3（设置页：缓存 TTL、token 预算、可选 Context7 后端）按反馈排期
