# Lifecycle: rename, and what to do with `setEditable`

Type: task
Status: open

The note asked whether the lifecycle can be simplified to "only container", or whether the
methods just need renaming.

**"Only container" is false.** `rendered` is a per-paint event with no derivation from the
container signal, and it is what drives `bind`. The Vue adapter needs three emit sites and an
epoch dedupe to produce it. A `Lifecycle → Host` simplification already landed in #255,
leaving three members in 24 lines.

**The rename case is weaker than it looked.** There is no symbol collision: `Host.onMounted`
has zero adapter call sites — it is called only from core (`OverlayController`, `TokenModel`,
`SelectionDriver`, `KeyboardController`, `ClipboardController`) — and Vue's own `onMounted`
appears only in files that never reference it. What is left is readability: `CONTEXT.md:59`
already warns against reading "Host" as the element, and `onMounted` reads like a framework
hook. Renaming is cosmetic churn unless the name is actively misleading someone.

**The real find sits next to it.** `TokenModel.setEditable` (`seam/TokenModel.ts:349`) has zero
production callers — only its own spec — and is a second writer of `container.contentEditable`
beside `SelectionDriver`. It is not stale, though: its docblock declares it a deliberate,
explicitly non-authoritative escape hatch that "core calls nowhere", `features/tokens/README.md:263`
documents it, `development/architecture.md:438` records it as unused by design, and it ships in
both adapters' published `dist/index.d.ts`. So removing it is an API change needing sign-off,
not a cleanup.

**Question.** Keep `setEditable` as documented dead surface, or drop it in the next breaking
release? And is the rename worth the churn on its own?
