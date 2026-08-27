# `softBreak` stays unbuilt — the standing deferral and its re-open trigger

Type: task
Status: wontfix
Blocked by: —

> Filed so the deferral has a home and a trigger, not to propose the work. Re-open only on the
> condition at the bottom.

## Problem

Under a `'\n'` separator a soft break is a CONTINUATION ROW, not a `softBreak` construct.
`outcome.md`'s item 1 lists the four declared costs (ADR-0011 amendment):

> Backspace at its start outdents before it merges (two presses to rejoin); a consumer cannot tell
> it from a Tab-nested row; typed into a row that has children it lands before them and shifts their
> ids; and a kind whose component ignores the `rows` prop paints no continuation at all.

The fourth of those is narrowed by `TokenModel.#settleRows` (`:1443`), which lifts children out of
a kind that hosts none — see [23](23-row-component-contract-is-silent.md) for what is left of it.

## Why it stays unbuilt (`insights.md:403-405`)

> ADR-0011's amendment declared four costs and the two the P6 review found were both repairable
> inside the continuation-row reading, in one expression each. Nothing since has produced a case the
> continuation cannot carry. It stays not-built until one does.

Context worth keeping with it: [05](05-per-item-rows.md)'s answer records that P2 took the
separator trade the other way and that *"under `'\n'` a soft break has no representation at all"*,
which is [08](08-soft-breaks-are-invisible.md) — whose representation half is answered and whose
visibility half rests on a grep the record itself corrected: `.Container span { white-space:
pre-wrap }` has been shipped since PR #115 and is at `packages/core/styles.module.css:237-240` at
`52ef65ae` (the record cites `:176-179`, which the file has since outgrown). Whether that rule is
sufficient for every row shape is still unmeasured.

## Re-open when

A gesture turns up that the continuation row cannot carry — not an aesthetic preference for a
`softBreak` field. Bring the case, not the feature.
