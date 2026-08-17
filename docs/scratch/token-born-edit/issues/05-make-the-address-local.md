# Phase 3 — make the address local

Status: needs-info

Type: research

Stop storing a Token's position, so an edit stops invalidating every Token after it.

## Why this is the phase that delivers G1

A keystroke costs two O(document) passes, not one. The parse is the first
([issue 04](04-make-the-parse-local.md)). The second is here: `adopt` retains prefix and suffix
Tokens by object, but the suffix walk shifts **both ends of every following node** by the same
delta, as plain field writes.

While a Token's address is stored state that goes stale the instant a sibling before it changes
length, "the edit is born in the Token and everything outward is derived" is not representable —
the edit is born in the Token and then immediately invalidates the whole suffix.

## Current mechanism

`position` is `{start, end}` on every `TreeNode`; `MarkNode` also carries `slotRange`. Both are
written by `adopt` from the parse tokens, as plain field writes with no signal trace — so a move
leaves no reactive trace and wakes no consumer.

Known readers, all inside `features/tokens/` (`addressSpace.spec.ts` enforces that nothing outside
reads `.position`):

- `transactions.applyText` — bounds the local range with `position.end - position.start`, and
  builds the splice from `position.start` plus the local offsets
- `transactions.applyStructural` — the splice window *is* `target.position.start/.end`
- `anchors.offsetOfAnchor` — the anchor-to-offset direction
- `tree/siblings.ts` — `mergePlan` / `movePlan`

## The risk to adjudicate, not assume

Every write verb currently lowers to a splice in **absolute projection coordinates**. If positions
become derived and derivation costs O(document), every write pays on demand what `adopt` used to
pay eagerly — the cost has moved, not gone. The win exists only if either derivation is sublinear
or amortised to near-nothing on the real access pattern, or the write verbs stop needing an
absolute offset at all. The second couples this phase to expressing edits as tree operations, and
if that is the honest answer then phase 3 and that idea are one project and the arc's ordering
needs correcting.

## The measurement that decides it

Two numbers, both currently unknown:

1. How many `position` writes one keystroke performs at 10 / 100 / 500 top-level Tokens, and the
   shape of the curve for an edit at the start, the middle and the end.
2. How many times `offsetOfAnchor` is called during one real keystroke, and from where. If it is
   called a handful of times, an O(document) walk costing microseconds may be strictly better than
   eagerly rewriting hundreds of fields — and the phase collapses to a deletion. If it is hot, the
   opposite.

If the position rewrite turns out to be a rounding error beside the full parse, that reorders the
arc and must be said first.

## The oracle

`tree/__testing__/snapshot.ts` deep-equals `stripIds(snapshot(tree))` against a fresh parse of the
tree's own projection, carrying **every** node's position, and `adopt.property.spec.ts` runs it
after every adopt. It is the only check comparing the whole tree — structure, positions, slot text
— against the parser rather than a hand-written expectation. Any design here must say what it still
discriminates; a design that quietly turns it into a tautology is worse than a slower one.

## Candidates

1. **Derived on demand** — the node stores a length, an offset is walked from the root when asked.
2. **Cached, lazily invalidated** — an offset plus a generation stamp; an edit bumps ancestors and
   right-siblings.
3. **No absolute offsets** — the write verbs carry Token identity plus a local range, and an offset
   is formed, if at all, only where the projection is actually spliced.

Under evaluation now, with measurement, in workflow `wscr4k8qt`.
