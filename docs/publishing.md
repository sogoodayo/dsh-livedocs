# dsh-livedocs 发布清单（v0.1.0）

> 代码侧已就绪：M1–M5 全部完成，49 项测试全过，真机（link 安装 + web profile）验证通过。
> 唯一卡点：GitHub 建仓需要本人登录。标注 👤 的步骤需要你操作，其余可代做。

## 〇、当前状态速览

| 项 | 状态 |
|---|---|
| 功能 | ✅ M1 三工具 / M2 版本钉选 / M2.5 斜杠命令 / M2.6 依赖注入+预热 / M3 设置卡片 / M3.7 策展注册表 / M4 Context7 兜底 / M5 嵌入式技能 |
| 测试 | ✅ 49 项全过（工作区 8 个测试套件） |
| 真机验证 | ✅ link 安装在真实宿主长期运行；工具、卡片、remote、预热、注册表均实测 |
| Gitee 镜像 | ✅ `gitee.com/sogoodeveryday/dsh-livedocs`（仅备份，**不能作为安装源**，`github:` 前缀只认 GitHub） |
| GitHub 仓库 | ⏸️ 待 👤 建仓 |
| npm 包 | ⏸️ 名字 `dsh-livedocs` 可用（已查 404）；打包已验证（16 文件 / 31.9 kB）；待 👤 `npm login` 后发布 |
| 分发方式 | **双轨**：Git 仓库（`dsh plugin add github:<账号>/dsh-livedocs`）+ npm（`dsh plugin add dsh-livedocs`，裸包名走 pnpm registry 解析，宿主源码已确认支持） |

## 一点五、发到 npm（👤 登录后一条命令）

发布前已验证的事实：

- `dsh plugin add` 底层是 pnpm，裸包名原样透传走 registry 解析（宿主 `plugin-*.js` 源码确认）
- 依赖已补全：`dsh-typert-protocol`、`schemastery` 原为漏声明（dev 期手动 vendor 掩盖了），现已写入 dependencies；三个依赖的目标版本在 registry 均存在
- ⚠️ DeepSeek 官方包的 `latest` 标签停在旧版（dsh-tools latest=0.0.1-rc.1），我们钉 `^0.1.2-rc.1` 预发布区间，解析到实测过的 0.1.2-rc.1，不受 latest 标签影响
- `npm pack --dry-run` 通过：16 文件、31.9 kB，无 node_modules / data / 测试残留

👤 发布步骤：

```bash
cd D:\my\deepseek-ai\dsh-livedocs
npm login                    # 需要 npm 账号（npmjs.com 注册，可能开 2FA）
npm publish                  # 非 scoped 包默认 public
```

⚠️ 注意：npm 发布接近不可逆（72 小时后无法 unpublish，版本号永久占用），确认 v0.1.0 内容无误再发。发布后安装验证：`dsh plugin --profile web add dsh-livedocs`。


## 一、推到 GitHub（👤）

⚠️ 现有 `origin` 指向 Gitee，先改名再关联 GitHub，避免远程冲突：

```bash
cd D:\my\deepseek-ai\dsh-livedocs

# 1. 把现有 origin（Gitee）改名保留为镜像
git remote rename origin gitee

# 2. 👤 方式 A：gh CLI（已登录则一条命令建仓+推送）
gh repo create dsh-livedocs --public --source=. --push \
  --description "Version-pinned live library docs for DeepSeek Harness — kill hallucinated APIs"

# 2. 👤 方式 B：网页建仓后手动关联
git remote add origin git@github.com:<你的账号>/dsh-livedocs.git
git push -u origin main

# 3. 之后日常推送：GitHub 为主，Gitee 做镜像
git push origin main && git push gitee main
```

建仓后立即打话题标签（awesome 列表和市场靠它自动收录）：

```bash
gh repo edit --add-topic dsh-plugin --add-topic deepseek-harness \
  --add-topic llms-txt --add-topic agent-docs --add-topic context7
```

## 二、Git 安装路径终验（建仓后必做）

link 安装已长期验证，但 `github:` 远程安装路径本身要走一遍：

```bash
dsh plugin --profile web add github:<你的账号>/dsh-livedocs
dsh web
```

验收三步：

1. 终端出现 `dsh-livedocs loaded` 日志 → 加载关 ✅
2. 对话中「用 docs_query 查一下 react 的 hooks 文档」→ 有 tool call 且返回版本钉选结果 → 注册关 ✅
3. 设置 → 插件 → 插件配置 → Live Docs 卡片展开正常、缓存列表可刷新 → 卡片关 ✅

通过后把实测 DSH 版本写进 README「兼容性」一节。

## 三、上架插件市场（👤 提交）

**分类决策（已拍板）**：主分类挂「**开发与运行时**」——人群精准、竞争密度低于「工具与能力」；「工具与能力」作为辅助标签带上（该分类插件过多，不做主分类）。不挂「文档与渲染」（语义不符，转化率归零）。

| 渠道 | 方式 | 说明 |
|---|---|---|
| **官方聚合市场**（deepseekharnessmarket.site） | 👤 GitHub 登录后提交仓库地址 | 流量最大，优先做；元数据格式以提交页为准 |
| **awesome-dsh-plugin** | 👤 提 PR | 社区精选列表，长尾曝光 |
| **cordis.run** | 👤 提交插件页面 | 会跑安全扫描；零原生依赖、纯 ESM 是加分项 |
| **DSH 市场 Discussion #3858** | 👤 讨论帖下发仓库地址 | 管理员手动上架，备选 |

## 四、上架文案（定稿，可直接粘贴）

**一句话简介**：
让 DSH 在写代码前拉到版本对应的官方文档——llms.txt 优先、lockfile 自动钉版本、离线缓存可用，零配置零 Key。

**详细描述**：
dsh-livedocs 是 DSH 的实时库文档插件。装上即注册 `livedocs` 嵌入式技能：agent 写/改/修涉及第三方库的代码前，会自动拉取**你项目里安装的那个版本**的官方文档再动手，从源头消灭幻觉 API。

**差异化卖点（对标 Context7）**：
1. **版本钉选**：读 node_modules / lockfile 实测版本，给的就是你项目里那个版本的文档（Context7 只能给它索引过的版本）
2. **零配置零 Key**：装好即生效——嵌入式技能自动触发，无需写规则、无需申请 Key
3. **离线可用**：7 天本地 LRU 缓存，断网返回过期缓存并显式标注
4. **长尾库兜底（可选）**：填 Context7 API Key 后，无 llms.txt/README 覆盖的小众库自动回退云端索引（默认关闭）
5. **可视化设置卡片**：开关、预热数量、缓存上限、自定义文档源、缓存列表管理，全部图形化
6. **token 预算可控**：目录常驻仅约 30 token，技能正文按需加载；每次查询预算由你定

**标签**：`dsh-plugin`、`deepseek-harness`、`llms-txt`、`agent-docs`、`context7`、`版本钉选`、`幻觉 API`

## 五、README 待补（👤 截图需你操作）

- [ ] **截图 3 张**（放 `docs/images/`，README 引用）：
  1. 一次真实的 `docs_query` 工具调用及返回（展示版本钉选头）
  2. 设置卡片展开态（展示全部配置项 + 缓存列表）
  3. `/docs react hooks` 斜杠命令效果
- [ ] 兼容性版本号（终验后填，如 `dsh >= 0.1.2`）
- [x] 徽章（License / DSH plugin，已加）
- [ ] 安装命令中的 `your-account` 替换为真实 GitHub 账号

## 六、发布后

```bash
git tag v0.1.0 && git push origin --tags && git push gitee --tags
```

- 观察 issue / Discussion；DSH 升级后第一时间验证兼容性（0.1.2-alpha 期间变过 inject 契约）
- 后续路线按用户反馈排期；候选：PyPI / crates.io 解析器、skill 内容按项目栈定制
