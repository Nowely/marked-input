# Vue `useMarkInfo` freezes `hasNestedMarks`

Status: needs-info

React reads the token context in the render body, so `useMarkInfo` recomputes every render
(`react/.../useMarkInfo.tsx:8`). Vue reads the context ref once in `setup` and returns a plain
object (`vue/.../useMarkInfo.ts:12`). A mark that keeps its id while gaining a nested child —
the flat-to-nested transition — would therefore never leave the flat branch in Vue: rows are
keyed by `node.id` (`Container.vue:85`), so the instance is reused and `setup` does not re-run.

Hypothesis. Every link is cited, none is executed. The repro to run before this becomes a task:
options `[{markup: '@[__slot__]'}]`, a Mark using the documented
`info.hasNestedMarks ? children : mark.slot()` pattern, value `@[hello]` edited to
`@[hello @[world]]`; compare React and Vue.

No test covers the transition — `Nested.spec.ts:148-149` reads `data-has-children` at mount
only. If it reproduces it is a Vue-only divergence that the shared story snapshot cannot catch,
because the transition happens after mount.

Related: 24 — the pattern this defect is reached through is the one the docs teach.
