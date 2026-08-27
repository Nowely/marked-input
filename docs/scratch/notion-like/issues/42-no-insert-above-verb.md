# There is no insert-ABOVE verb, and `addSibling` names no caret

Type: task
Status: needs-triage — re-read 2026-08-27; still a published-surface decision, and the engine half is confirmed present
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


## Re-read, 2026-08-27 (T-E)

Verified against the code as it stands rather than taken from the ticket:

- `RowNode.addSibling` is `node => ...#insertAfter(node, ...)` and returns `boolean` — it opens
  BELOW and names no caret (`TokenModel.ts`, the `addSibling` arm of `#commands`).
- `RowNode.writeRows` DOES carry one: `splitPlan` answers `{window, text, caret}` and
  `#tx.applyRange(plan.window, plan.text, plan.caret)` applies it, in both value modes. So the
  primitive the verb would need exists at the layer it would need it, exactly as the ticket says.
- `#insertAfter` already answers the caret for its own use — it reads the position the anchor node
  is followed by before the splice and resolves it after — so an insert-ABOVE would be the same
  function with the sequence index one lower, not a new mechanism.

**It stays open, and the reason is unchanged and still right.** Both shapes are additions to
`RowNode`, which is published surface, and the contract group's rule is that a published surface
change gets its own decision. Naming the two shapes so the decision is a choice rather than a
design session:

1. `addSibling(options?: {before?: boolean; caret?: boolean})` — one verb, two flags, no new name
   on the surface. Cheapest to publish, and the flag pair is the shape AGENTS.md's own
   "boolean prop proliferation" warning is about.
2. `addSibling` keeps its meaning and `addSiblingBefore` joins it, with BOTH answering the caret
   unconditionally. Two names, no flags, and it forces a decision about whether the existing verb
   starts moving the caret — which is a behaviour change to a shipped verb, not an addition.

The showcase's table footer is the one in-repo caller that wants it
(`node.turnInto(tableLine, {text: '⏎|+ ' + slot})` — an insert-above expressed through a
turn-THIS-row verb), so whichever shape lands has a call site to prove itself against on the day.
