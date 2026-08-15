# Caret addresses inside a mark

Status: needs-info

Reported as "no real caret map to component text". As a regression that is false, proven; as a
statement of the contract it is true and deliberate.

A mark's own text has exactly two addresses, its edges. `NodeAnchor` carries an offset only for
a `TextNode` (`tree/types.ts:82-83`), `anchorAt` answers a slotless mark with its own boundary —
"A mark interior is not anchorable" (`tree/anchors.ts:33`) — and `CONTEXT.md:34` says the same
in vocabulary: a mark with no slot is atomic. Only slot content is addressable, because slot
children are real text nodes.

Nothing was lost in the rewrites. The numeric predecessor deleted in #272 had the identical
mark arm: `git show 36a621c8^:packages/core/src/features/tokens/dom/domBoundary.ts` line 69
returns `token.position.start` / `.end`, and the two generations before it answered the same
way. If anything the map got finer — `nearestMarkEdge` (`dom/domBoundary.ts:141`) now reads the
click's offset, at one bit, to pick the near edge where the old code always answered the left.

What is left is a real observation with two possible referents:

- Mark values are not editable. That is issue 01, already open.
- Two addressing systems coexist. The anchor projection refuses any position inside a mark,
  while `TokenHandle.caretIndex()` measures a full character offset over a token's scope
  (`dom/TokenHandle.ts:86`) — and block mode uses it on a mark, since every row of a
  slot-leading block markup is a mark (`features/tokens/README.md:114`). If this is what was
  meant, it belongs in `docs/scratch/core-layers/` as an architecture question, not here as a
  defect.
