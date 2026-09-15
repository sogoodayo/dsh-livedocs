// dsh-livedocs browser half — settings card for 设置 → 插件 → 插件配置.
//
// Hand-written lazy-CJS factory bundle in the DSH client module format
// (window.__ModuleLoader__.load). No build step: the shell's shared module
// table provides react / cordis / slots primitives, and cross-plugin
// collaboration goes through cordis services (slots, settingsScope, remote),
// never through value imports — that is the client bundle purity rule.
//
// What the card edits lives in the `livedocs` settings namespace (Host side:
// lib/config.js). What the card shows live (cache entries) rides the
// `livedocs` Typert remote namespace, mounted here from hand-written
// descriptors — the gateway accepts src-json results and the passthrough
// parameter codec below satisfies the client-side strict-codec check.

window.__ModuleLoader__.load({
  id: 'dsh-livedocs',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const h = React.createElement
    const { useState, useSyncExternalStore } = React

    const NS = 'livedocs'

    // ---- hand-written Typert contribution (client half of lib/remote.js) ----
    // The client gateway requires strict codecs on parameters and calls only
    // schema.parse(); a passthrough schema keeps the wire JSON untouched.
    const passthrough = { parse: (value) => value }
    const jsonCodec = { mode: 'strict', typeSymbol: 'dsh-livedocs#json', schema: passthrough }
    const CONTRIBUTION = {
      package: 'dsh-livedocs',
      descriptors: [
        {
          id: 'dsh-livedocs#livedocs/listDocs',
          service: 'livedocsController',
          namespace: NS,
          method: 'listDocs',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-livedocs#livedocs/removeDoc',
          service: 'livedocsController',
          namespace: NS,
          method: 'removeDoc',
          invocation: { kind: 'direct' },
          parameters: [{ name: 'key', wire: 'key', source: 'json', codec: jsonCodec }],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-livedocs#livedocs/clearDocs',
          service: 'livedocsController',
          namespace: NS,
          method: 'clearDocs',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-livedocs#livedocs/checkUpdate',
          service: 'livedocsController',
          namespace: NS,
          method: 'checkUpdate',
          invocation: { kind: 'direct' },
          parameters: [],
          result: { mode: 'src-json' },
        },
      ],
    }

    // ------------------------------------------------------------------ i18n
    // Settings card language. The locale itself is a settings field (zh/en,
    // default zh), so the card re-renders live when the user switches.
    const STRINGS = {
      zh: {
        cardDesc: '实时库文档：版本钉定、依赖注入、文档预热与自定义文档源',
        readOnly: '当前部署的设置文档为只读。',
        loading: '设置加载中…',
        saveFailed: '保存失败',
        language: '界面语言',
        languageHint: '中文 / English（即时生效）',
        enabled: '启用 dsh-livedocs',
        enabledHint: '总开关：关闭后工具与注入全部停用',
        injectDeps: '依赖上下文注入',
        injectDepsHint: '把项目依赖（含安装版本）注入系统提示',
        prefetch: '依赖文档预热',
        prefetchHint: '会话开始时后台拉取头部依赖的文档',
        skill: '嵌入式技能（自动触发）',
        skillHint: '在模型的技能目录注册 livedocs 技能，写第三方库代码时自动加载使用规则',
        prefetchTopN: '预热数量 Top N',
        prefetchTopNHint: '每个项目预热的依赖个数（0–10）',
        cacheTtl: '缓存有效期（天）',
        cacheTtlHint: '超过后重新拉取（1–90）',
        cacheMax: '缓存上限（条）',
        cacheMaxHint: '超出后按最久未使用自动淘汰（1–1000）',
        context7: 'Context7 API Key（可选兜底源）',
        context7HintOn: '已配置：无 llms.txt/README 覆盖的库将回退到 Context7 云端索引',
        context7HintOff: '留空关闭；在 context7.com/dashboard 免费申请（ctx7sk 开头）',
        customDocs: '自定义文档源',
        customDocsNote: '按库名命中的私有文档（llms.txt 链接），优先于 npm 解析链。',
        customDocsName: '库名，如 my-lib',
        customDocsVersion: '版本(可空)',
        add: '添加',
        remove: '移除',
        removeDocTitle: '删除自定义文档源',
        removeDocBody: (name) => `确定删除 ${name} 的文档源吗？`,
        cacheTitle: '已缓存文档',
        clearAll: '清空全部',
        view: '查看',
        refresh: '刷新',
        loadingDots: '加载中…',
        remoteDown: '远程服务不可用（请确认插件已加载并重启 dsh web）',
        cacheEmpty: '缓存为空。',
        cacheCount: (n, bytes) => `${n} 条，共 ${bytes}`,
        cacheHit: (hit, total) => `命中 ${hit} / ${total} 条`,
        filterPlaceholder: '按包名过滤…',
        stale: '(已过期)',
        cachedAt: (size, time, url) => `${size} · 缓存于 ${time} · ${url}`,
        noMatch: '没有匹配的条目。',
        showMore: (n) => `显示更多（还有 ${n} 条）`,
        removeCacheTitle: '移除缓存文档',
        removeCacheBody: (lib, ver) => `确定移除 ${lib}@${ver} 的缓存吗？下次查询会重新拉取。`,
        clearCacheTitle: '清空全部缓存',
        clearCacheBody: (n) => `确定清空全部 ${n} 条缓存吗？下次查询会重新拉取。`,
        updateTitle: '插件更新',
        updateHint: (cur) => `当前版本 ${cur} · 对比 npm 最新发布`,
        updateHintIdle: '对比 npm registry 上的最新发布',
        checkUpdate: '检查更新',
        checking: '检查中…',
        updateFailed: (err) => `检查失败：${err}（可稍后重试，或检查网络）`,
        updateAvailable: (latest, cur) => `发现新版本 ${latest}（当前 ${cur}）。在终端执行以下命令完成升级：`,
        upToDate: (v) => `已是最新版本（${v}）✓`,
        projectNote: '项目级覆盖：在项目根目录放置 .dsh-livedocs.json（同名字段优先于此处全局设置；API Key 属凭据，仅支持全局设置，不接受项目级覆盖）。',
        cancel: '取消',
        confirmDelete: '确认删除',
        help: '帮助',
        c7what: 'Context7 是收录 10000+ 开源库文档的云端索引服务（Upstash 出品）。',
        c7how: '本插件默认从 llms.txt / GitHub 直接拉文档，免费且无需注册；只有当某个库这两种来源都拉不到时，填了 Key 才会自动回退到 Context7 查询，提高小众库的命中率。留空则完全不启用。',
        c7site: '官网：',
        c7keys: 'Key 申请与管理（ctx7sk 开头）：',
        c7keysDoc: 'API Keys 文档',
        c7dash: '免费申请入口：',
      },
      en: {
        cardDesc: 'Live library docs: version pinning, deps injection, prefetch & custom sources',
        readOnly: 'The settings document of this deployment is read-only.',
        loading: 'Loading settings…',
        saveFailed: 'Save failed',
        language: 'Language',
        languageHint: '中文 / English (applies instantly)',
        enabled: 'Enable dsh-livedocs',
        enabledHint: 'Master switch: disables all tools and injection when off',
        injectDeps: 'Deps context injection',
        injectDepsHint: 'Inject project dependencies (with installed versions) into the system prompt',
        prefetch: 'Docs prefetch',
        prefetchHint: 'Warm docs for top dependencies in the background when a session starts',
        skill: 'Embedded skill (auto-trigger)',
        skillHint: 'Register the livedocs skill so the agent auto-loads usage rules before coding against libraries',
        prefetchTopN: 'Prefetch Top N',
        prefetchTopNHint: 'How many dependencies to prefetch per project (0–10)',
        cacheTtl: 'Cache TTL (days)',
        cacheTtlHint: 'Entries are refetched after this (1–90)',
        cacheMax: 'Cache limit (entries)',
        cacheMaxHint: 'Least-recently-used entries are evicted beyond this (1–1000)',
        context7: 'Context7 API Key (optional fallback)',
        context7HintOn: 'Configured: libraries without llms.txt/README coverage fall back to the Context7 cloud index',
        context7HintOff: 'Empty = off; get a free key at context7.com/dashboard (starts with ctx7sk)',
        customDocs: 'Custom doc sources',
        customDocsNote: 'Private docs (llms.txt links) matched by library name, before the npm resolution chain.',
        customDocsName: 'Library, e.g. my-lib',
        customDocsVersion: 'Version (opt.)',
        add: 'Add',
        remove: 'Remove',
        removeDocTitle: 'Remove custom doc source',
        removeDocBody: (name) => `Remove the doc source for ${name}?`,
        cacheTitle: 'Cached docs',
        clearAll: 'Clear all',
        view: 'View',
        refresh: 'Refresh',
        loadingDots: 'Loading…',
        remoteDown: 'Remote service unavailable (make sure the plugin is loaded and restart dsh web)',
        cacheEmpty: 'Cache is empty.',
        cacheCount: (n, bytes) => `${n} entries, ${bytes} total`,
        cacheHit: (hit, total) => `${hit} of ${total} matched`,
        filterPlaceholder: 'Filter by package…',
        stale: '(stale)',
        cachedAt: (size, time, url) => `${size} · cached ${time} · ${url}`,
        noMatch: 'No matching entries.',
        showMore: (n) => `Show more (${n} left)`,
        removeCacheTitle: 'Remove cached docs',
        removeCacheBody: (lib, ver) => `Remove the cache for ${lib}@${ver}? It will be refetched on the next query.`,
        clearCacheTitle: 'Clear the whole cache',
        clearCacheBody: (n) => `Clear all ${n} cached entries? They will be refetched on the next query.`,
        updateTitle: 'Plugin update',
        updateHint: (cur) => `Current ${cur} · compared against the latest npm release`,
        updateHintIdle: 'Compares against the latest release on the npm registry',
        checkUpdate: 'Check for updates',
        checking: 'Checking…',
        updateFailed: (err) => `Check failed: ${err} (retry later, or check your network)`,
        updateAvailable: (latest, cur) => `New version ${latest} available (current ${cur}). Run this in a terminal to upgrade:`,
        upToDate: (v) => `Up to date (${v}) ✓`,
        projectNote: 'Per-project override: place .dsh-livedocs.json in the project root (same-named fields win over the global settings here; the API key is a credential and is global-only).',
        cancel: 'Cancel',
        confirmDelete: 'Delete',
        help: 'Help',
        c7what: 'Context7 is a cloud index of docs for 10,000+ open-source libraries (by Upstash).',
        c7how: 'This plugin fetches docs directly from llms.txt / GitHub — free, no sign-up. Only when both sources miss does a configured key enable the Context7 fallback, improving coverage for niche libraries. Empty means never used.',
        c7site: 'Website: ',
        c7keys: 'Get & manage keys (ctx7sk…): ',
        c7keysDoc: 'API Keys docs',
        c7dash: 'Free signup: ',
      },
    }

    // ---------------------------------------------------------------- styles
    const css = {
      card: { border: '0.5px solid var(--dsw-alias-border-l2, #e2e2e2)', borderRadius: 12, overflow: 'hidden', listStyle: 'none' },
      header: {
        width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
        padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2, font: 'inherit',
        color: 'var(--dsw-alias-label-primary, inherit)',
      },
      name: { fontSize: 14, fontWeight: 600 },
      desc: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)' },
      body: { padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
      label: { display: 'flex', flexDirection: 'column', gap: 2 },
      labelHint: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)' },
      input: {
        width: 72, font: 'inherit', padding: '4px 8px', borderRadius: 6,
        border: '0.5px solid var(--dsw-alias-border-l3, #ccc)',
        background: 'var(--dsw-alias-bg-primary, transparent)', color: 'inherit',
      },
      sectionTitle: { fontSize: 12, fontWeight: 600, color: 'var(--dsw-alias-label-secondary, #888)', textTransform: 'uppercase', letterSpacing: 0.4 },
      button: {
        font: 'inherit', fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
        border: '0.5px solid var(--dsw-alias-border-l3, #ccc)',
        background: 'var(--dsw-alias-bg-secondary, transparent)', color: 'inherit',
      },
      danger: { color: 'var(--dsw-alias-label-error, #c00)' },
      docRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '0.5px solid var(--dsw-alias-border-l2, #eee)' },
      docName: { fontWeight: 600, fontSize: 12 },
      docMeta: { fontSize: 11, color: 'var(--dsw-alias-label-secondary, #888)', wordBreak: 'break-all' },
      error: { fontSize: 12, color: 'var(--dsw-alias-label-error, #c00)' },
      note: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)' },
      grow: { flex: 1, minWidth: 0 },
      textInput: {
        flex: 1, font: 'inherit', fontSize: 12, padding: '4px 8px', borderRadius: 6, minWidth: 0,
        border: '0.5px solid var(--dsw-alias-border-l3, #ccc)',
        background: 'var(--dsw-alias-bg-primary, transparent)', color: 'inherit',
      },
      scrollList: {
        maxHeight: 260, overflowY: 'auto',
        border: '0.5px solid var(--dsw-alias-border-l2, #eee)', borderRadius: 8, padding: '0 10px',
      },
      helpWrap: { position: 'relative', display: 'inline-flex', marginLeft: 6, verticalAlign: 'middle' },
      helpIcon: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%', fontSize: 10, cursor: 'help', userSelect: 'none',
        border: '0.5px solid var(--dsw-alias-border-l3, #ccc)',
        color: 'var(--dsw-alias-label-secondary, #888)',
      },
      helpBubble: {
        position: 'absolute', bottom: '100%', left: 0, marginBottom: 6, width: 280,
        padding: '10px 12px', zIndex: 50, borderRadius: 8,
        background: 'var(--dsw-alias-bg-primary, #fff)',
        border: '0.5px solid var(--dsw-alias-border-l2, #e2e2e2)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        fontSize: 12, lineHeight: 1.7, fontWeight: 400,
        color: 'var(--dsw-alias-label-primary, inherit)',
        display: 'flex', flexDirection: 'column', gap: 6,
      },
      helpLink: { color: 'var(--dsw-alias-label-info, #06c)', wordBreak: 'break-all' },
      overlay: {
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      },
      dialog: {
        width: 320, borderRadius: 12, padding: '16px 18px',
        background: 'var(--dsw-alias-bg-primary, #fff)',
        color: 'var(--dsw-alias-label-primary, inherit)',
        border: '0.5px solid var(--dsw-alias-border-l2, #e2e2e2)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.18)',
        display: 'flex', flexDirection: 'column', gap: 10,
      },
      dialogTitle: { fontSize: 14, fontWeight: 600 },
      dialogBody: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, #888)', wordBreak: 'break-all' },
      dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
    }

    const fmtBytes = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`)
    const fmtTime = (ts) => new Date(ts).toLocaleString()

    // ------------------------------------------------------------- controls
    function Toggle(props) {
      return h('div', { style: css.row },
        h('div', { style: css.label },
          h('span', null, props.label),
          props.hint ? h('span', { style: css.labelHint }, props.hint) : null,
        ),
        h('input', {
          type: 'checkbox',
          checked: !!props.value,
          disabled: props.disabled,
          onChange: (e) => props.onChange(e.target.checked),
        }),
      )
    }

    function NumberField(props) {
      const [draft, setDraft] = useState(String(props.value))
      const [editing, setEditing] = useState(false)
      const shown = editing ? draft : String(props.value)
      const commit = () => {
        setEditing(false)
        const next = Number(draft)
        if (Number.isFinite(next) && next >= props.min && next <= props.max && next !== props.value) {
          props.onChange(Math.round(next))
        } else {
          setDraft(String(props.value))
        }
      }
      return h('div', { style: css.row },
        h('div', { style: css.label },
          h('span', null, props.label),
          props.hint ? h('span', { style: css.labelHint }, props.hint) : null,
        ),
        h('input', {
          style: css.input,
          type: 'number',
          min: props.min,
          max: props.max,
          value: shown,
          disabled: props.disabled,
          onFocus: () => { setDraft(String(props.value)); setEditing(true) },
          onChange: (e) => setDraft(e.target.value),
          onBlur: commit,
          onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur() },
        }),
      )
    }

    // Hover "?" help bubble. The wrapper owns the hover state so moving the
    // pointer into the bubble keeps it open — the links inside stay clickable.
    function HelpTip(props) {
      const [open, setOpen] = useState(false)
      return h('span', {
        style: css.helpWrap,
        onMouseEnter: () => setOpen(true),
        onMouseLeave: () => setOpen(false),
        onClick: (e) => { e.stopPropagation(); setOpen(!open) },
      },
        h('span', { style: css.helpIcon, 'aria-label': props['aria-label'] ?? '?' }, '?'),
        open ? h('span', { style: css.helpBubble }, ...(props.children ?? [])) : null,
      )
    }

    // Masked credential input; commits on blur/Enter, empty string disables.
    function KeyField(props) {
      const [draft, setDraft] = useState(props.value ?? '')
      const [editing, setEditing] = useState(false)
      const shown = editing ? draft : (props.value ?? '')
      const commit = () => {
        setEditing(false)
        const next = draft.trim()
        if (next !== (props.value ?? '')) props.onChange(next)
      }
      return h('div', { style: css.row },
        h('div', { style: css.label },
          h('span', null, props.label, props.help ?? null),
          props.hint ? h('span', { style: css.labelHint }, props.hint) : null,
        ),
        h('input', {
          style: { ...css.textInput, flex: 'none', width: 200 },
          type: 'password',
          placeholder: 'ctx7sk…',
          value: shown,
          disabled: props.disabled,
          autoComplete: 'off',
          spellCheck: false,
          onFocus: () => { setDraft(props.value ?? ''); setEditing(true) },
          onChange: (e) => setDraft(e.target.value),
          onBlur: commit,
          onKeyDown: (e) => { if (e.key === 'Enter') e.target.blur() },
        }),
      )
    }

    // ------------------------------------------------------- confirm dialog
    // Lightweight modal for destructive actions (删除/清空). Cancel via the
    // 取消 button, the backdrop, or Esc.
    function ConfirmDialog(props) {
      const onKeyDown = (e) => { if (e.key === 'Escape') props.onCancel() }
      return h('div', {
        style: css.overlay,
        role: 'presentation',
        tabIndex: -1,
        onClick: (e) => { if (e.target === e.currentTarget) props.onCancel() },
        onKeyDown,
        ref: (el) => el && el.focus(),
      },
        h('div', { style: css.dialog, role: 'alertdialog', 'aria-modal': 'true' },
          h('div', { style: css.dialogTitle }, props.title),
          h('div', { style: css.dialogBody }, props.body),
          h('div', { style: css.dialogActions },
            h('button', { type: 'button', style: css.button, onClick: props.onCancel }, props.cancelLabel ?? '取消'),
            h('button', {
              type: 'button',
              style: { ...css.button, ...css.danger },
              onClick: props.onConfirm,
            }, props.confirmLabel ?? '确认删除'),
          ),
        ),
      )
    }

    // ---------------------------------------------------------- custom docs
    function CustomDocs(props) {
      const t = props.t
      const [name, setName] = useState('')
      const [url, setUrl] = useState('')
      const [version, setVersion] = useState('')
      const docs = props.value ?? []
      const add = () => {
        const trimmedName = name.trim()
        const trimmedUrl = url.trim()
        if (!trimmedName || !/^https:\/\//.test(trimmedUrl)) return
        if (docs.some((d) => d.name.toLowerCase() === trimmedName.toLowerCase())) return
        const entry = { name: trimmedName, url: trimmedUrl }
        if (version.trim()) entry.version = version.trim()
        props.onChange([...docs, entry])
        setName(''); setUrl(''); setVersion('')
      }
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('span', { style: css.sectionTitle }, t('customDocs')),
        h('span', { style: css.note }, t('customDocsNote')),
        docs.map((doc) =>
          h('div', { key: doc.name, style: css.docRow },
            h('div', { style: css.grow },
              h('div', { style: css.docName }, doc.name + (doc.version ? `@${doc.version}` : '')),
              h('div', { style: css.docMeta }, doc.url),
            ),
            h('button', {
              type: 'button', style: { ...css.button, ...css.danger },
              onClick: () => props.confirm(
                t('removeDocTitle'),
                t('removeDocBody')(doc.name),
                () => props.onChange(docs.filter((d) => d.name !== doc.name)),
              ),
            }, t('remove')),
          ),
        ),
        h('div', { style: { display: 'flex', gap: 6 } },
          h('input', { style: { ...css.textInput, flex: 2 }, placeholder: t('customDocsName'), value: name, onChange: (e) => setName(e.target.value) }),
          h('input', { style: { ...css.textInput, flex: 4 }, placeholder: 'https://…/llms.txt', value: url, onChange: (e) => setUrl(e.target.value) }),
          h('input', { style: { ...css.textInput, flex: 1 }, placeholder: t('customDocsVersion'), value: version, onChange: (e) => setVersion(e.target.value) }),
          h('button', { type: 'button', style: css.button, onClick: add }, t('add')),
        ),
      )
    }

    // ---------------------------------------------------------- update panel
    // Checks the npm registry for a newer plugin release (Host side does the
    // network call; the card only renders the state machine).
    function UpdatePanel(props) {
      const t = props.t
      const [state, setState] = useState({ phase: 'idle', result: null, error: null })
      const check = async () => {
        if (!props.remoteApi.ready()) {
          setState({ phase: 'error', result: null, error: t('remoteDown') })
          return
        }
        setState({ phase: 'checking', result: null, error: null })
        try {
          const result = await props.remoteApi.checkUpdate()
          if (result?.error) {
            setState({ phase: 'error', result, error: result.error })
          } else {
            setState({ phase: 'done', result, error: null })
          }
        } catch (err) {
          setState({ phase: 'error', result: null, error: String(err?.message ?? err) })
        }
      }
      const r = state.result
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: css.row },
          h('div', { style: css.label },
            h('span', null, t('updateTitle')),
            h('span', { style: css.labelHint },
              r?.current ? t('updateHint')(r.current) : t('updateHintIdle')),
          ),
          h('button', {
            type: 'button', style: css.button, disabled: state.phase === 'checking', onClick: check,
          }, state.phase === 'checking' ? t('checking') : t('checkUpdate')),
        ),
        state.phase === 'error'
          ? h('span', { style: css.error }, t('updateFailed')(state.error))
          : null,
        state.phase === 'done' && r
          ? r.updateAvailable
            ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
              h('span', { style: css.note }, t('updateAvailable')(r.latest, r.current)),
              h('code', {
                style: {
                  fontSize: 12, padding: '6px 10px', borderRadius: 6, userSelect: 'all',
                  background: 'var(--dsw-alias-bg-secondary, rgba(127,127,127,0.12))',
                  border: '0.5px solid var(--dsw-alias-border-l2, #e2e2e2)',
                },
              }, r.command),
            )
            : h('span', { style: css.note }, t('upToDate')(r.latest ?? r.current))
          : null,
      )
    }

    // ----------------------------------------------------------- cache panel
    const PAGE = 20 // batch size for incremental rendering
    function CachePanel(props) {
      const t = props.t
      const [state, setState] = useState({ phase: 'idle', entries: [], totalBytes: 0, error: null })
      const [filter, setFilter] = useState('')
      const [shown, setShown] = useState(PAGE)
      const load = async () => {
        if (!props.remoteApi.ready()) {
          setState({ phase: 'error', entries: [], totalBytes: 0, error: t('remoteDown') })
          return
        }
        setState((s) => ({ ...s, phase: 'loading', error: null }))
        try {
          const result = await props.remoteApi.list()
          setState({ phase: 'ready', entries: result?.entries ?? [], totalBytes: result?.totalBytes ?? 0, error: null })
          setShown(PAGE)
        } catch (err) {
          setState({ phase: 'error', entries: [], totalBytes: 0, error: String(err?.message ?? err) })
        }
      }
      const remove = (entry) => {
        props.confirm(
          t('removeCacheTitle'),
          t('removeCacheBody')(entry.library, entry.version),
          async () => {
            try {
              await props.remoteApi.remove(entry.key)
            } finally {
              await load()
            }
          },
        )
      }
      const clear = () => {
        props.confirm(
          t('clearCacheTitle'),
          t('clearCacheBody')(state.entries.length),
          async () => {
            try {
              await props.remoteApi.clear()
            } finally {
              await load()
            }
          },
        )
      }
      const keyword = filter.trim().toLowerCase()
      const visible = keyword
        ? state.entries.filter((e) => `${e.library}@${e.version}`.toLowerCase().includes(keyword))
        : state.entries
      const batch = visible.slice(0, shown)
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: css.row },
          h('span', { style: css.sectionTitle }, t('cacheTitle')),
          h('div', { style: { display: 'flex', gap: 6 } },
            state.phase === 'ready' && state.entries.length > 0
              ? h('button', { type: 'button', style: { ...css.button, ...css.danger }, onClick: clear }, t('clearAll'))
              : null,
            h('button', { type: 'button', style: css.button, onClick: load },
              state.phase === 'loading' ? t('loadingDots') : state.phase === 'idle' ? t('view') : t('refresh')),
          ),
        ),
        state.error ? h('span', { style: css.error }, state.error) : null,
        state.phase === 'ready'
          ? state.entries.length === 0
            ? h('span', { style: css.note }, t('cacheEmpty'))
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
              h('div', { style: css.row },
                h('span', { style: css.note },
                  keyword ? t('cacheHit')(visible.length, state.entries.length) : t('cacheCount')(state.entries.length, fmtBytes(state.totalBytes))),
                h('input', {
                  style: { ...css.textInput, flex: '0 1 180px' },
                  placeholder: t('filterPlaceholder'),
                  value: filter,
                  onChange: (e) => { setFilter(e.target.value); setShown(PAGE) },
                }),
              ),
              h('div', { style: css.scrollList },
                batch.map((entry) =>
                  h('div', { key: entry.key, style: css.docRow },
                    h('div', { style: css.grow },
                      h('div', { style: css.docName },
                        `${entry.library}@${entry.version}`,
                        entry.stale ? h('span', { style: { ...css.docMeta, marginLeft: 6 } }, t('stale')) : null,
                      ),
                      h('div', { style: css.docMeta },
                        t('cachedAt')(fmtBytes(entry.size), fmtTime(entry.fetchedAt), entry.sourceUrl),
                      ),
                    ),
                    h('button', { type: 'button', style: { ...css.button, ...css.danger }, onClick: () => remove(entry) }, t('remove')),
                  ),
                ),
                batch.length === 0 ? h('div', { style: { ...css.note, padding: '8px 0' } }, t('noMatch')) : null,
              ),
              visible.length > batch.length
                ? h('button', {
                  type: 'button', style: css.button,
                  onClick: () => setShown(shown + PAGE),
                }, t('showMore')(visible.length - batch.length))
                : null,
            )
          : null,
      )
    }

    // ----------------------------------------------------------------- card
    function LivedocsCard(props) {
      const [open, setOpen] = useState(false)
      const { scope, remoteApi } = props
      const snap = useSyncExternalStore(
        (fn) => scope.subscribe(fn),
        () => scope.getSnapshot(),
      )
      const [error, setError] = useState(null)
      const [confirm, setConfirm] = useState(null) // { title, body, action } | null

      if (snap.status === 'unavailable') {
        return null // 本部署未组装该插件——不留痕迹（与官方卡片语义一致）
      }
      const value = snap.value ?? {}
      const writable = snap.writable !== false
      const locale = value.locale === 'en' ? 'en' : 'zh'
      const t = (key) => STRINGS[locale][key] ?? STRINGS.zh[key] ?? key
      const set = (field, next) => {
        setError(null)
        Promise.resolve(scope.set(field, next)).catch((err) => setError(String(err?.message ?? err)))
      }
      // Destructive actions must pass through the confirm dialog.
      const askConfirm = (title, body, action) => setConfirm({ title, body, action })
      const runConfirm = () => {
        const pending = confirm
        setConfirm(null)
        Promise.resolve()
          .then(() => pending.action())
          .catch((err) => setError(String(err?.message ?? err)))
      }

      return h('li', { style: css.card },
        h('button', {
          type: 'button', style: css.header, 'aria-expanded': open,
          onClick: () => setOpen(!open),
        },
          h('span', { style: css.name }, 'Live Docs (dsh-livedocs)'),
          h('span', { style: css.desc }, t('cardDesc')),
        ),
        open
          ? h('div', { style: css.body },
            !writable ? h('p', { style: css.error }, t('readOnly')) : null,
            snap.status !== 'ready' ? h('span', { style: css.note }, t('loading')) : null,
            error ? h('p', { style: css.error }, `${t('saveFailed')}：${error}`) : null,
            h('div', { style: css.row },
              h('div', { style: css.label },
                h('span', null, t('language')),
                h('span', { style: css.labelHint }, t('languageHint')),
              ),
              h('select', {
                style: { ...css.input, width: 110 },
                value: locale,
                disabled: !writable,
                onChange: (e) => set('locale', e.target.value),
              },
                h('option', { value: 'zh' }, '中文'),
                h('option', { value: 'en' }, 'English'),
              ),
            ),
            h(Toggle, {
              label: t('enabled'), hint: t('enabledHint'),
              value: value.enabled !== false, disabled: !writable,
              onChange: (v) => set('enabled', v),
            }),
            h(Toggle, {
              label: t('injectDeps'), hint: t('injectDepsHint'),
              value: value.injectDeps !== false, disabled: !writable,
              onChange: (v) => set('injectDeps', v),
            }),
            h(Toggle, {
              label: t('prefetch'), hint: t('prefetchHint'),
              value: value.prefetch !== false, disabled: !writable,
              onChange: (v) => set('prefetch', v),
            }),
            h(Toggle, {
              label: t('skill'), hint: t('skillHint'),
              value: value.skill !== false, disabled: !writable,
              onChange: (v) => set('skill', v),
            }),
            h(NumberField, {
              label: t('prefetchTopN'), hint: t('prefetchTopNHint'),
              value: value.prefetchTopN ?? 3, min: 0, max: 10, disabled: !writable,
              onChange: (v) => set('prefetchTopN', v),
            }),
            h(NumberField, {
              label: t('cacheTtl'), hint: t('cacheTtlHint'),
              value: value.cacheTtlDays ?? 7, min: 1, max: 90, disabled: !writable,
              onChange: (v) => set('cacheTtlDays', v),
            }),
            h(NumberField, {
              label: t('cacheMax'), hint: t('cacheMaxHint'),
              value: value.cacheMaxEntries ?? 200, min: 1, max: 1000, disabled: !writable,
              onChange: (v) => set('cacheMaxEntries', v),
            }),
            h(KeyField, {
              label: t('context7'),
              help: h(HelpTip, { 'aria-label': t('help') },
                h('span', null, t('c7what')),
                h('span', null, t('c7how')),
                h('span', null,
                  t('c7site'),
                  h('a', { href: 'https://context7.com', target: '_blank', rel: 'noreferrer', style: css.helpLink }, 'context7.com'),
                ),
                h('span', null,
                  t('c7keys'),
                  h('a', { href: 'https://context7.com/docs/howto/api-keys', target: '_blank', rel: 'noreferrer', style: css.helpLink }, t('c7keysDoc')),
                ),
                h('span', null,
                  t('c7dash'),
                  h('a', { href: 'https://context7.com/dashboard', target: '_blank', rel: 'noreferrer', style: css.helpLink }, 'context7.com/dashboard'),
                ),
              ),
              hint: value.context7Key?.trim() ? t('context7HintOn') : t('context7HintOff'),
              value: value.context7Key ?? '', disabled: !writable,
              onChange: (v) => set('context7Key', v),
            }),
            h(CustomDocs, {
              value: value.customDocs,
              onChange: (v) => set('customDocs', v),
              confirm: askConfirm,
              t,
            }),
            h(UpdatePanel, { remoteApi, t }),
            h(CachePanel, { remoteApi, confirm: askConfirm, t }),
            h('span', { style: css.note }, t('projectNote')),
          )
          : null,
        confirm
          ? h(ConfirmDialog, {
            title: confirm.title,
            body: confirm.body,
            cancelLabel: t('cancel'),
            confirmLabel: t('confirmDelete'),
            onCancel: () => setConfirm(null),
            onConfirm: runConfirm,
          })
          : null,
      )
    }

    // ---------------------------------------------------------------- apply
    exports.inject = ['slots', 'settingsScope', 'remote']
    exports.apply = function apply(ctx) {
      const scope = ctx.settingsScope.bind({ namespace: NS })

      // Mount the hand-written contribution so the card can reach the Host
      // cache. Lifetime follows this fiber; failure just hides remote actions.
      let remoteReady = false
      ctx.effect(() => {
        let disposed = false
        let unmount = null
        Promise.resolve(ctx.remote.$mount(CONTRIBUTION))
          .then((dispose) => {
            if (disposed) {
              void dispose()
              return
            }
            unmount = dispose
            remoteReady = true
          })
          .catch(() => { remoteReady = false })
        return () => {
          disposed = true
          remoteReady = false
          if (unmount) void unmount()
        }
      }, 'dsh-livedocs: remote mount')

      // Remote namespace methods resolve to a RemoteResult envelope
      // ({ok: true, value} | {ok: false, error}) — callers must unwrap it
      // themselves; the namespace service never throws business failures.
      const unwrap = async (call) => {
        const result = await call
        if (!result || result.ok !== true) {
          throw new Error(result?.error?.message ?? 'remote call failed')
        }
        return result.value
      }
      const remoteApi = {
        ready: () => remoteReady && !!ctx.get('remote.livedocs'),
        list: () => unwrap(ctx.get('remote.livedocs').listDocs()),
        remove: (key) => unwrap(ctx.get('remote.livedocs').removeDoc(key)),
        clear: () => unwrap(ctx.get('remote.livedocs').clearDocs()),
        checkUpdate: () => unwrap(ctx.get('remote.livedocs').checkUpdate()),
      }

      ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({
        name: 'settings.plugin.item',
        key: NS,
        inject: () => ({ scope, remoteApi }),
      }, LivedocsCard))
    }

    return module.exports
  },
})
