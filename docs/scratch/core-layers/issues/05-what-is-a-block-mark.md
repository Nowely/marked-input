# "Improve block mark architecture" — which referent?

Type: research
Status: open
Blocked by: none, but unanswerable as written

"Block mark" is not vocabulary. `CONTEXT.md:95` resolved "block" into **Block layout** (the
mode) and **Row** (the unit), and names `slots.block` / `slotProps.block` as the published
row-wrapper names. The phrase does have one concrete referent in code docs —
`features/tokens/README.md:114` states that every row of a slot-leading block markup is a mark —
but that is only one of three readings, and they are three different projects:

- **The row-as-mark parse contract.** Concrete open defect underneath it: backlog issue 15, a
  block row whose slot starts with a mark.
- **`slots.block` chrome ownership** — who renders and owns the row wrapper. Overlaps 03.
- **First-class rows** — already recorded as Open in `docs/records/tree-core-decisions.md`, with
  `EditController`'s `caretOffset` parameter as its residue.

**Question.** Which one was meant? Until that is answered this cannot be scored, let alone
sequenced.
