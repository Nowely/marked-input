# The docs still teach the rejected slot shape

Status: ready-for-human

Core has decided what a slot renders: the slot's text tokens are bare `<span>` surfaces that
inherit editability from the one host, and core writes their text
(`dom/editableState.ts:33-38`, ADR-0002). What we publish still teaches the other shape —
`info.hasNestedMarks ? children : mark.slot()` — in the guide (`guides/nested-marks.md:34`,
`:81`), on the RFC page (`development/rfc-nested-marks.md:26`) and in both shipped fixtures
(`Nested.fixtures.react.tsx:192`, `Nested.fixtures.vue.ts:237`).

A consumer who follows it gets an uneditable slot. With no `TokenChildren` mounted there is no
child-sequence host, so the children frame is dropped and the slot's text token never gets a
handle; the mark root is then written `contenteditable=false` (`editableState.ts:34`). The
rendered text does refresh — the adapter re-renders the Mark when value, meta or children
change — so the symptom is "cannot type into it", not "stale forever". Rendering `children`
instead makes the same value editable.

Decide: strike the fallback from the guide, the RFC page and both fixtures and state that a
slot mark MUST render `children`; or keep the fallback and give core a way to keep such a slot
bound. Either way add the browser test that types inside an inline nested slot — the current
`Nested` specs never type into one.

Needs a person: it changes what the published guide promises.
