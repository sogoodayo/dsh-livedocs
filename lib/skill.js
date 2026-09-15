// Embedded skill — the zero-config trigger path (M5).
//
// The plugin registers one runtime skill into the host's skill registry
// (ctx.skills). The model-facing catalog only carries the name + description
// (~30 tokens per turn); the full body loads only when the model invokes the
// skill — token cost is on-demand, unlike a permanent system-prompt section.
//
// This complements, not replaces, the AGENTS.md rules from docs_setup:
// rules require a manual one-time setup; the embedded skill works the moment
// the plugin is installed.
//
// Pure data module, no DSH imports — unit-testable outside the harness.

/** Kebab-case skill name; validated by the host's isSkillName(). */
export const SKILL_NAME = 'livedocs'

/**
 * Catalog-facing routing metadata. The description is what the model reads
 * to decide whether to load the skill — keep it trigger-focused.
 */
export const SKILL_DESCRIPTION =
  'Version-pinned official docs for third-party libraries. ' +
  'Load BEFORE writing, fixing, or reviewing code that uses an external ' +
  'library/framework/SDK API — training data may be outdated.'

export const SKILL_WHEN_TO_USE =
  'Writing or debugging code that imports an external package; a build/lint/' +
  'runtime error points at a library API (unknown export, wrong signature, ' +
  'deprecated option); or the user asks how to use a library.'

/** Skill body — instructions the model receives on invocation. */
export const SKILL_CONTENT = `# Live library docs (dsh-livedocs)

Pull version-pinned official documentation BEFORE writing or fixing code that
uses a third-party library. Never rely on training data for library APIs.

## Workflow

1. Call \`docs_query\` with:
   - \`library\` — the npm package name (e.g. "react", "@tanstack/react-query")
   - \`topic\` — what you are about to use (e.g. "hooks", "routing")
   - \`projectDir\` — the current project root, so the installed version is
     pinned automatically (never guess versions from memory)
2. Write code against the returned docs, not against memory.
3. When a build/lint/test/runtime error points at a library API (unknown
   export, wrong signature, deprecated option), call \`docs_query\` for that
   library BEFORE attempting a fix — the API may have changed.

## Rules

- Use \`topic\` to narrow results and keep the default token budget unless
  the task genuinely needs more context.
- At most 3 \`docs_query\` calls per question; if docs stay insufficient,
  answer with the best information you have and say so.
- If the result carries a version WARNING, verify APIs against the project's
  installed version before using them.
- If the result reports the Context7 fallback failed, tell the user once and
  continue with the best information you have.
- The user can run a manual lookup anytime with \`/livedocs <library> [topic]\` (alias: \`/docs\`).
`

/**
 * Build the runtime skill registration accepted by ctx.skills.register().
 * Invocation defaults to model+user invocable; source is 'runtime'.
 */
export function createSkillRegistration() {
  return {
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    whenToUse: SKILL_WHEN_TO_USE,
    source: 'runtime',
    content: SKILL_CONTENT,
  }
}
