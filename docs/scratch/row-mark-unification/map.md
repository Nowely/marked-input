# Row/Mark unification — map

Label: wayfinder:map

## Destination

An approved design spec at `docs/scratch/row-mark-unification/spec.md` that
converges Row and Mark on one node structure and one facility set — per-node
state, one render path, one input pipeline — on top of token-born-edit's
phase-4 target surface, continuing its G3 ("the Row stops being a stopgap").
Implementation is a separate effort after this map.

## Notes

- Settled at charting (2026-08-22): premise is one structure + one facility
  set. Row does NOT become a parser Markup — designed in full and rejected
  2026-08-20 (token-born-edit issue 08); never re-propose.
- One-way: rows reuse mark machinery. Marks do not gain drag/menu/grip.
- Behavior changes are allowed, but EVERY observable change is listed
  explicitly and shown to the maintainer before it enters the spec.
- Adapters (React + Vue block components) and the input pipeline are in scope.
- Skills: /grilling + /domain-modeling on decision tickets; /prototype where
  a ticket names it. Dialog in Russian; artifacts in English.
- Facts baseline: census.md in this directory (2026-08-22, HEAD e6433bce).

## Decisions so far

<!-- one line per closed ticket -->

## Not yet specified

- Verb-set convergence details (does a Row ever need `update()`; does
  `mergeWith` stay row-only) — sharpens after 01/02.
- Migration order for the implementation — belongs to the spec (08).
- Storybook Drag page reshaping (name, shared-spec harness) — after 04.
- Whether BLOCK_MENU_ITEMS stays a core content contract — after 04.
- Fate of published `slots.block` / `slotProps.block` names — after 02/04;
  published contract, glossary says "not a rename target".

## Out of scope

- Row as parser Markup (rejected 2026-08-20, token-born-edit issue 08).
- Symmetric unification: draggable/hoverable inline marks — separate effort.
- Block-selection mode (rows-as-objects UX) — separate feature (2026-08-11).
- Shift+Enter under separator `'\n'` — ADR-0009's open sub-decision, not ours.
- Implementing the spec — the next effort, not this map.
