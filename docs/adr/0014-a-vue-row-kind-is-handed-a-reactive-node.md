# A Vue row kind is handed a reactive node

A row kind's component receives `node`. In React that is enough: a repaint re-runs the body and
re-reads everything. In Vue it was not — what a `RowNode` answers are core's signals, which Vue's
reactivity does not see, so a kind that read `node.slot()` was correct on the first paint and stale
for ever after. Vue kinds now receive the node through a wrapper that makes those reads reactive,
and the two adapters' contract is the same sentence again.

**It is a read-time bridge, not a copy.** Every property access on the wrapper first touches the
row's own subscription ref — the same `renderSubscription(node)` `Row.vue` already held — and does
so INSIDE THE CALLER'S EFFECT. That is the whole of why it works where the alternatives did not: a
child component's own render effect is what has to see a reactive read, and a parent's repaint does
not reach a child whose props have not changed.

## What it replaces

An incantation, written once in the showcase and documented in one guide paragraph:

```ts
const useSlot = (node: RowNode) => useMarkput(() => () => node.slot())
```

Nothing in the type system said it was required, and a consumer met the rule as silence: read the
node, watch it work, ship, and the panel is stale. It also cost an acceptance test a tooth —
`boundary.spec.ts` had to admit a zero-argument `useMarkput` into a fence whose whole point is that
a Notion-shaped editor is options and components. That rule now names the hook outright again, which
was issue 46's stated acceptance test.

## What it costs

**The node a Vue kind receives is not the object the editor holds.** `node.id`, every read and
every verb behave exactly as before — methods are bound to the real node — but `===` against a node
obtained elsewhere is false. Rows are compared by `id` in this codebase already, and ids are never
reused.

**One bound function per method read.** A consumer's component reads a handful of properties per
paint; core never sees the wrapper, because `Row.vue` swaps it in only for the props a KIND
receives, after the resolver has run on the real node.

## Measured

All 146 Vue showcase tests pass with the incantation deleted and a plain `computed(() =>
node.slot())` in its place. Removing the wrapper while keeping that plain read reddens _moves a card
between board columns_ and _re-counts both columns from the document the drag wrote_ — two of the
three the workaround was originally measured against. Restoring the hook to a showcase file reddens
the tightened boundary rule on both the import and the call.

## Status

Accepted 2026-08-29 by the maintainer, who was shown the identity cost and chose this over
publishing a `useNode(node)` hook or widening `RowProps` with a `slot` member. React is unchanged:
it never needed a bridge.
