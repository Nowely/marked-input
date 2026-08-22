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

- **Chrome leaves the row** (2026-08-22, direction taken on
  [02](issues/02-one-render-path.md)) — grip, drop indicator and menu move out
  of the row element into one per-editor layer. Four of six adversarial passes
  proposed it independently; no proposal contained it. Unmeasured, so
  [04](issues/04-adapter-convergence.md) is re-scoped as its prototype and the
  blocking edge is inverted: 02 constrains 01, not the reverse.
- [One input pipeline](issues/03-one-input-pipeline.md) — shape A (one listener
  pair, block arms after the shared checks) plus a row-separator expansion in
  `anchorsForDelete`, which kills the 46-line row tier without rewriting
  `stepAnchor`. Ranged-Enter options C and D died on a measured regression.
- [Stale premises](issues/07-stale-premises-sweep.md) — the filter is gone; 9
  stale sites fixed (the census found 3), backlog 09 and 15 both closed as
  non-reproducing, and `anchorAt`'s `side` param is now measured
  production-dead.

## Not yet specified

- Verb-set convergence details (does a Row ever need `update()`; does
  `mergeWith` stay row-only) — sharpens after 01/02.
- Migration order for the implementation — belongs to the spec (08).
- Storybook Drag page reshaping (name, shared-spec harness) — after 04.
- Whether BLOCK_MENU_ITEMS stays a core content contract — after 04; its
  published `run: (store: BlockStore) => void` loses its parameter type if the
  per-row store dissolves.
- Fate of published `slots.block` / `slotProps.block` names — after 02's slot
  registry sub-question; glossary says "not a rename target", and
  `slotProps.block` typechecks on neither adapter today.
- The ADR-0007 amendment that chrome is addressed by position rather than row
  identity — decided once, when the chrome layer is measured, not per ticket.

## Found in round 1, outside every ticket

Pre-existing defects surfaced by the adversarial passes. None belongs to this
map's destination; recorded so they are not lost.

- **The row drop handler accepts any external drag.**
  `BlockStore.#onContainerDrop` reads `dataTransfer.getData('text/plain')` and
  refuses only `NaN` — no provenance check. With `draggable` on, dropping the
  text `0` from another application reorders the document.
- **Block layout silently corrupts the model through a consumer's
  contenteditable island** — the behavior change [03](issues/03-one-input-pipeline.md)
  fixes as a side effect. Inline pins the opposite contract.
- **ADR-0007's body says `BlockController` prunes per-row state by node id.**
  It does not prune at all; `BlockController.ts:11-25` argues object keying is
  chosen precisely so no prune is needed. Stale ADR text.
- **`blockEdit.ts:48-66` justifies the stored-selection tier with a
  `pendingStructural` window that ADR-0008's own 2026-08-19 amendment says no
  longer exists.** The tier is still load-bearing; the written reason is dead.
- **`anchorAt`'s `side` parameter is production-dead** — measured, one
  hand-assembled test holds it up. A signature change, so it needs its own yes.

## Out of scope

- Row as parser Markup (rejected 2026-08-20, token-born-edit issue 08).
- Symmetric unification: draggable/hoverable inline marks — separate effort.
- Block-selection mode (rows-as-objects UX) — separate feature (2026-08-11).
- Shift+Enter under separator `'\n'` — ADR-0009's open sub-decision, not ours.
- Implementing the spec — the next effort, not this map.
