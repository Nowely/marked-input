# Announce the commit delta as a set difference, not an accumulator

Status: needs-info

Blocked on a decision, not on information: whether this is worth doing at all. It removes a
concept and a bug class, but it does not advance the row/parser/addressing work, so it earns
its place only as standalone cleanup. Parked by the maintainer 2026-08-18 pending that call.

## What

`commit.ts` maintains the announced delta as state: `pendingDelta` (three `Set`s), `foldDelta`,
`drainDelta`, and `deltaOf`'s subtree walk. `foldDelta` merges every apply landing inside a
pending window and cancels **by exact id**, so an id added and then removed before the paint is
never announced.

Replace the maintenance with a derivation: keep `#announced` (the id space the consumer was last
told about) and `#touched` (ids whose own content changed this window), and announce

```
added   = ids \ announced
removed = announced \ ids
updated = touched ∩ ids ∩ announced
```

where `ids` is the flattened tree `bind` **already walks**. `bind.ts:76` builds that `treeIds`
`Set` today and throws it away; returning it as `BindResult.ids` is the only new surface.

## Why it might be worth it

- Deletes `foldDelta`, `drainDelta`, the three-`Set` accumulator and `deltaOf`'s subtree walk,
  and they reappear nowhere.
- The whole "the accumulator lost or mis-merged an id" class stops being expressible — every
  announcement re-diffs against truth, so a dropped one is self-healing. The repo has already
  shipped and fixed one bug of that class.
- Blast radius: `commit.ts` internals plus one returned field in `bind.ts`. **Zero adapter
  files, zero published type shape change.**

## Why it might not be

It is concept 3 of the eight in the commit pipeline, and concept 3 was **proven not to be caused
by the paint lag** — it comes from accumulate-versus-derive. So it neither blocks nor is blocked
by the row, parser or addressing work. It is orthogonal cleanup with a small payoff, on nobody's
critical path.

## Evidence

A **superset** of this change — delta-as-difference **plus** swapping the `pendingStructural`
latch for a counter — was implemented and measured at HEAD during the investigation: core 985,
react 244, vue 238, `tsc --noEmit` clean, and all 27 `commitPipeline.spec.ts` cases passing with
**zero spec edits**. Mutation-sensitive: flipping one id in `removed` reds
`commitPipeline.spec.ts:738` with the exact payload diff.

**Caveat, stated rather than hidden:** the subset was never measured alone. Re-measure before
trusting the green.

## Must be declared in the PR body

`TokenDelta`'s array **order** changes — `added` iterates `bind`'s depth-first tree order,
`removed` the previous announced `Set`. Payload *content* is identical (measured). Order is
unobserved by any spec today (every order-sensitive `toEqual` is on a 0- or 1-element array),
which is exactly why it must be declared instead of asserted away: `MarkputApi.changed` is
published surface.

## Do not bundle

The live control-root predicate that travelled with this proposal is a separate change. It is
what forces the 27-case spec rewrite, and its own defect is measured cold: on a 60-Row draggable
Block-layout document one keystroke produced `byElement: 7` lookups and `isControlRootChecks: 0`,
because `#locate` short-circuits on the handle before reaching the control check. Real defect,
unreachable in any driven flow. Separate proposal, separate commit.
