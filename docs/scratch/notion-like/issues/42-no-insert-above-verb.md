# There is no insert-ABOVE verb, and `addSibling` names no caret

Type: task
Status: needs-triage
Blocked by: —

## Problem

Split out of [16](16-trailing-paragraph.md) on 2026-08-27, for the same reason as
[41](41-empty-raw-body-has-no-caret-line.md): 16 judged it NOT dissolved, said why, and then took
`Status: resolved`, which took this with it.

`map.md:1211-1217`, judged correct as it stands and recorded as the option API's gap. The showcase's
table footer writes its `+ New` row as

```ts
node.turnInto(tableLine, {text: '\n|+ ' + slot})
```

— an insert-ABOVE expressed through a turn-THIS-row verb, because *"`addSibling` opens BELOW, there
is no insert-above verb, and no published way to say 'put the caret in the row I just made'."*

## What 16 changed, and what it did not

16's trailing-row guarantee removed the reason `choose` needed an insert-AFTER contract: the row
below an atomic block now exists without anyone asking for it. The gap that stays is the other
direction and the caret:

- no verb opens a row ABOVE the one it is called on;
- `RowNode.addSibling` opens below and names no caret, so a consumer that wants the user typing in
  the row it just made has no way to say so.

`RowNode.writeRows` DOES name a caret since [19](19-mid-body-split-loses-the-caret.md) — the plan
carries an absolute offset and the verb applies it — so the primitive exists at the layer a verb
would need it. That is what makes this a published-surface question rather than an engine one.

## The shape a fix would take

Either `addSibling` gains a `{before?: boolean}` and a caret contract, or a new pair of verbs is
published. Both are additions to `RowNode`, which is why this is filed rather than taken: the
contract group's rule was that a published surface change gets its own decision.
