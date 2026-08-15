# The hook shapes: `useOverlay`, `useMark`, `useMarkInfo`

Status: needs-info

Two notes asked to "simplify" these, and neither survives contact with the current code as
written.

**`useOverlay` — "expose above suggestions level".** It already works in any component under the
store context, a Mark included, so it is already above `Suggestions` *inside* the editor. It is
not reachable outside `<MarkedInput>`, and re-adding a consumer-free getter reopens a decided
contract — `MarkputApi` dropped it deliberately. The hook itself is 25 lines and its five-member
shape is published and documented, so "simplify" cannot mean shrinking it without a break.
Which reading was meant: reachable outside the editor, mounted by the consumer instead of by
`OverlayRenderer`, or fewer members?

**`useMark` / nested marks.** `useMark` is already an eight-line context read; the old
`store.tokens.markFor(token)` lookup is gone. Nothing in it is nesting-specific — the nesting
metadata lives in `useMarkInfo` (`depth`, `hasNestedMarks`), and parent traversal is a deliberate
non-feature (`guides/nested-marks.md:45`). The only simplification the code supports is folding
`useMarkInfo` into `useMark`: `hasNestedMarks` is one line off `mark.children()` and `depth` is
the sole addition. Both hooks are published, so that is a break, not a cleanup.

Two live defects sit on this surface and should be fixed with it rather than around it: backlog
25 (Vue freezes `hasNestedMarks` at `setup`) and backlog 27 (`useOverlay().style` never updates).
