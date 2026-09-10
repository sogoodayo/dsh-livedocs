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
      ],
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

    // ---------------------------------------------------------- custom docs
    function CustomDocs(props) {
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
        h('span', { style: css.sectionTitle }, '自定义文档源'),
        h('span', { style: css.note }, '按库名命中的私有文档（llms.txt 链接），优先于 npm 解析链。'),
        docs.map((doc) =>
          h('div', { key: doc.name, style: css.docRow },
            h('div', { style: css.grow },
              h('div', { style: css.docName }, doc.name + (doc.version ? `@${doc.version}` : '')),
              h('div', { style: css.docMeta }, doc.url),
            ),
            h('button', {
              type: 'button', style: { ...css.button, ...css.danger },
              onClick: () => props.onChange(docs.filter((d) => d.name !== doc.name)),
            }, '移除'),
          ),
        ),
        h('div', { style: { display: 'flex', gap: 6 } },
          h('input', { style: { ...css.textInput, flex: 2 }, placeholder: '库名，如 my-lib', value: name, onChange: (e) => setName(e.target.value) }),
          h('input', { style: { ...css.textInput, flex: 4 }, placeholder: 'https://…/llms.txt', value: url, onChange: (e) => setUrl(e.target.value) }),
          h('input', { style: { ...css.textInput, flex: 1 }, placeholder: '版本(可空)', value: version, onChange: (e) => setVersion(e.target.value) }),
          h('button', { type: 'button', style: css.button, onClick: add }, '添加'),
        ),
      )
    }

    // ----------------------------------------------------------- cache panel
    function CachePanel(props) {
      const [state, setState] = useState({ phase: 'idle', entries: [], totalBytes: 0, error: null })
      const load = async () => {
        if (!props.remoteApi.ready()) {
          setState({ phase: 'error', entries: [], totalBytes: 0, error: '远程服务不可用（请确认插件已加载并重启 dsh web）' })
          return
        }
        setState((s) => ({ ...s, phase: 'loading', error: null }))
        try {
          const result = await props.remoteApi.list()
          setState({ phase: 'ready', entries: result?.entries ?? [], totalBytes: result?.totalBytes ?? 0, error: null })
        } catch (err) {
          setState({ phase: 'error', entries: [], totalBytes: 0, error: String(err?.message ?? err) })
        }
      }
      const remove = async (key) => {
        try {
          await props.remoteApi.remove(key)
        } finally {
          await load()
        }
      }
      const clear = async () => {
        try {
          await props.remoteApi.clear()
        } finally {
          await load()
        }
      }
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        h('div', { style: css.row },
          h('span', { style: css.sectionTitle }, '已缓存文档'),
          h('div', { style: { display: 'flex', gap: 6 } },
            state.phase === 'ready' && state.entries.length > 0
              ? h('button', { type: 'button', style: { ...css.button, ...css.danger }, onClick: clear }, '清空全部')
              : null,
            h('button', { type: 'button', style: css.button, onClick: load },
              state.phase === 'loading' ? '加载中…' : state.phase === 'idle' ? '查看' : '刷新'),
          ),
        ),
        state.error ? h('span', { style: css.error }, state.error) : null,
        state.phase === 'ready'
          ? state.entries.length === 0
            ? h('span', { style: css.note }, '缓存为空。')
            : h('div', null,
              h('span', { style: css.note }, `${state.entries.length} 条，共 ${fmtBytes(state.totalBytes)}`),
              state.entries.map((entry) =>
                h('div', { key: entry.key, style: css.docRow },
                  h('div', { style: css.grow },
                    h('div', { style: css.docName },
                      `${entry.library}@${entry.version}`,
                      entry.stale ? h('span', { style: { ...css.docMeta, marginLeft: 6 } }, '(已过期)') : null,
                    ),
                    h('div', { style: css.docMeta },
                      `${fmtBytes(entry.size)} · 缓存于 ${fmtTime(entry.fetchedAt)} · ${entry.sourceUrl}`,
                    ),
                  ),
                  h('button', { type: 'button', style: { ...css.button, ...css.danger }, onClick: () => remove(entry.key) }, '移除'),
                ),
              ),
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

      if (snap.status === 'unavailable') {
        return null // 本部署未组装该插件——不留痕迹（与官方卡片语义一致）
      }
      const value = snap.value ?? {}
      const writable = snap.writable !== false
      const set = (field, next) => {
        setError(null)
        Promise.resolve(scope.set(field, next)).catch((err) => setError(String(err?.message ?? err)))
      }

      return h('li', { style: css.card },
        h('button', {
          type: 'button', style: css.header, 'aria-expanded': open,
          onClick: () => setOpen(!open),
        },
          h('span', { style: css.name }, 'Live Docs (dsh-livedocs)'),
          h('span', { style: css.desc }, '实时库文档：版本钉定、依赖注入、文档预热与自定义文档源'),
        ),
        open
          ? h('div', { style: css.body },
            !writable ? h('p', { style: css.error }, '当前部署的设置文档为只读。') : null,
            snap.status !== 'ready' ? h('span', { style: css.note }, '设置加载中…') : null,
            error ? h('p', { style: css.error }, `保存失败：${error}`) : null,
            h(Toggle, {
              label: '启用 dsh-livedocs', hint: '总开关：关闭后工具与注入全部停用',
              value: value.enabled !== false, disabled: !writable,
              onChange: (v) => set('enabled', v),
            }),
            h(Toggle, {
              label: '依赖上下文注入', hint: '把项目依赖（含安装版本）注入系统提示',
              value: value.injectDeps !== false, disabled: !writable,
              onChange: (v) => set('injectDeps', v),
            }),
            h(Toggle, {
              label: '依赖文档预热', hint: '会话开始时后台拉取头部依赖的文档',
              value: value.prefetch !== false, disabled: !writable,
              onChange: (v) => set('prefetch', v),
            }),
            h(NumberField, {
              label: '预热数量 Top N', hint: '每个项目预热的依赖个数（0–10）',
              value: value.prefetchTopN ?? 3, min: 0, max: 10, disabled: !writable,
              onChange: (v) => set('prefetchTopN', v),
            }),
            h(NumberField, {
              label: '缓存有效期（天）', hint: '超过后重新拉取（1–90）',
              value: value.cacheTtlDays ?? 7, min: 1, max: 90, disabled: !writable,
              onChange: (v) => set('cacheTtlDays', v),
            }),
            h(CustomDocs, {
              value: value.customDocs,
              onChange: (v) => set('customDocs', v),
            }),
            h(CachePanel, { remoteApi }),
            h('span', { style: css.note },
              '项目级覆盖：在项目根目录放置 .dsh-livedocs.json（同名字段优先于此处全局设置）。'),
          )
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

      const remoteApi = {
        ready: () => remoteReady && !!ctx.get('remote.livedocs'),
        list: () => ctx.get('remote.livedocs').listDocs(),
        remove: (key) => ctx.get('remote.livedocs').removeDoc(key),
        clear: () => ctx.get('remote.livedocs').clearDocs(),
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
