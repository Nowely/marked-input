# What else can move into core?

Type: research
Status: open

Adapter deduplication as a whole is closed — the two suggestion keyboard handlers genuinely
differ in semantics. But five specific behaviours are implemented twice over core primitives
that already exist:

- Suggestion keydown wiring and active-index state (React `Suggestions.tsx` vs Vue
  `Suggestions.vue`), while `filterSuggestions` and `navigateSuggestions` are already core
  exports. Note issue 16 sits here: the stale-index bug lives in exactly this duplicated state.
- The grip visibility rule (`DragHandle.tsx` vs `DragHandle.vue`).
- Container / user-ref composition (`Container.tsx` vs `Container.vue`).
- The row index, passed down from the render map, where core has `rootIndexOf`.
- The render-announcement protocol, which Vue reimplements with three emit sites and a manual
  epoch dedupe — while core already owns a render epoch.

**Question.** Which of the five can move into core without making the adapters depend on
framework-specific timing? The render-announcement one is the interesting case: core has half
the protocol already, so the split is arbitrary rather than principled.

Sequence with 01 — the ref-composition and announcement items both hinge on who owns the
container.
