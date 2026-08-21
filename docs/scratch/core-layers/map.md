# Core layers

Where the boundaries inside `@markput/core` are still wrong, and what would have to be true to
move them. Six open questions, all raised as maintainer notes on 2026-08-15 and each checked
against the tree before it was written down. None is a defect; every one of them is a design
question whose answer is a ticket.

Read with `docs/records/tokenmodel-architecture.md`, `docs/records/established-contracts.md`
and `docs/adr/0001`–`0003`.

## Notes

The layer split itself is done — `parser/ → tree/ → dom/ → seam/` with a stated no-upward-edge
rule (`features/tokens/README.md:20-30`). What is left is ownership, not structure: who holds
the container, who holds row state, and which duplicated adapter behaviour belongs below the
adapter line.

Two of the six touch published surface (`MarkputApi.container`, `TokenModel.setEditable`), so
they cannot be settled inside core alone.

## Decisions so far

- 06 resolved (2026-08-21): the block row-array projection is neither moved into `tree/` nor
  kept — it dissolved. `addRowUnanchored` composes from two anchor slices through the existing
  `read`; `project`/`compose`/`insertRow` are deleted. See
  [06-block-row-array-manager.md](issues/06-block-row-array-manager.md).
- 03 partial (2026-08-21): the "fold the two derivable fields" option is executed —
  `BlockStore` now takes the `action` event and a live `rootIndexOf` reader at construction,
  and the adapters attach bare elements. The store-union question itself stays open. See
  [03-token-and-block-store-union.md](issues/03-token-and-block-store-union.md).

## Fog

- Whether "hide the host in the token model" is worth doing at all once the eight production
  readers outside `DomModel` are counted (01).
- What "block mark" refers to — three candidate referents, three different projects (05).
