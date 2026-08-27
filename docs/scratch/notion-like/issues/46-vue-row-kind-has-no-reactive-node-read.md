# A Vue row kind has no reactive read of its own node, so every kind copies an incantation

Type: task
Status: needs-triage
Blocked by: —

> Filed out of [26](26-vue-showcase-p12.md), which discovered it and shipped the workaround. The
> brief for that pass said "fix what is a defect, file what is a contract question"; this is the
> contract question, and it went unfiled until the review round.

## Problem

`RowProps` hands a Vue row kind `meta`, `depth`, `index` and `node`. The first three are ordinary
props and are reactive. Everything asked of the `node` — `node.slot()`, `node.meta()` — is a core
signal, and core's signals are not Vue-reactive: read straight in a template it is right on the
first paint and stale for ever after, because the render effect that read it has nothing to
invalidate it. A `computed` is worse, not better — with no reactive dependency at all it caches its
first answer — and reading through a method only survives while the kind itself re-renders, which
it does not when it hands the reading to a CHILD component (`Atomic`, and the leaf inside it): a
child with unchanged props and a compiled stable slot is skipped when its parent repaints.

So there is exactly one shape that works, and it is not in the type system:

```ts
const useSlot = (node: RowNode) => useMarkput(() => () => node.slot())
```

`options.vue.ts:76` writes it once for the showcase's seven raw-bodied kinds, and
`guides/row-kinds.md:173-195` documents it. Nothing else says so.

MEASURED, ticket 26's own mutation check: replacing that bridge with a plain
`({value: node.slot()})` reddens exactly three Vue tests of the showcase — *moves a card between
board columns*, *re-counts both columns from the document the drag wrote*, and *writes nothing at
all when a click on a bookmark is typed over*. The alternative that looked like it should work —
reading through a method in the template, so it re-runs on every parent render — still reddens two.
The bridge is load-bearing.

## Why it matters

**A consumer meets this as silence.** They read `RowProps`, call `node.slot()`, see it work on the
first paint, ship, and their panel is stale for ever. Nothing in the type system or in any test
says so; only the guide does. React has no equivalent rule — a re-render re-reads everything — so
this is a rule a Vue consumer has to learn from prose alone.

**It cost an acceptance test a tooth.** `boundary.spec.ts`'s store-hook rule used to be *"the
showcase imports no store hook at all"*; it is now *"a zero-argument `useMarkput` selector is
allowed"* (`boundary.spec.ts:117-140`). That narrowing was taken for a missing adapter affordance
rather than for a consumer need — the showcase reaches for `useMarkput` only because there is no
other way to read its own node — and it is the one hole in a fence whose whole point is that a
Notion-shaped editor is options and components.

## Candidate answers

1. **A published `useRowSlot(node)` / `useNode(node)` in `@markput/vue`.** The bridge with a name
   and a doc page. Smallest, and it keeps the subscription's shape where the adapter can change it.
2. **Hand the raw body down as a reactive `RowProps` member.** `Row.vue` already holds a
   `renderSubscription(props.node)` ref; a kind could take `slot` beside `meta`. Wider surface, and
   it answers only the reads `Row.vue` chose to make.

Either way, `boundary.spec.ts`'s store-hook rule tightens back to a total ban once one exists, and
that is the acceptance test for this ticket: the showcase's Vue paint imports no store hook at all,
and the rule below `WHAT IT ADMITS` goes back to naming `useMarkput` outright.
