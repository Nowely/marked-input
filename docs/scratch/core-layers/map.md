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

Nothing resolved yet.

## Fog

- Whether "hide the host in the token model" is worth doing at all once the eight production
  readers outside `DomModel` are counted (01).
- What "block mark" refers to — three candidate referents, three different projects (05).
- Whether the block row-array projection over strings is a layering fault or the right shape
  for what it does (06).
