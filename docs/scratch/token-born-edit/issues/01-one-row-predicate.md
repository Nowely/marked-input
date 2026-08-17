# One Row predicate, owned by `tree/`

Status: ready-for-agent

The question "is this a Row?" is asked in four places, and two of them are near-duplicate
predicates that differ by a single clause:

- `tree/siblings.ts:9` — `isSlotLeading`
- `keyboard/blockEdit.ts:13` — `isTextLikeRow`, which is the same test plus `node.kind === 'text'`
- `parser/core/PatternMatcher.ts:139` — the parser's own `isSlotLeading`
- `parser/core/Match.ts:51` — the slot-leading special case

`tree/` owns the tree's questions, so export one predicate from there and delete the other. The
parser's two are a separate matter and belong to
[phase 1](03-make-the-row-extent-local.md) — leave them.

## Why now, ahead of the decision

Agreed as the arc's first item precisely because it does **not** depend on the phase 0 outcome.
Every candidate Row boundary moves this question somewhere; moving one predicate is cheaper than
moving two, whichever way the decision goes. It is a pre-factor, not a competing change.

## Scope

One predicate, its export, and the call sites. No behaviour change: if the two predicates disagree
on any input reachable today, that is a defect and it must be reported rather than silently
resolved in either direction — say which inputs, and stop.

## Verification

`pnpm test`, `pnpm run typecheck`, `pnpm run lint:check`. The block keyboard specs
(`keyboard/blockEdit.spec.ts`) and `tree/siblings`' own specs are the ones that would notice.
