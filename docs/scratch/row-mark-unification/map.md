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
- **Execution is carried INSIDE this map** (maintainer, 2026-08-22), overriding
  the default that a map only decides. Once a ticket's decision is taken and
  nothing blocks it, it is implemented here rather than deferred to a later
  effort. The destination is unchanged: the spec still gets assembled in
  [08](issues/08-assemble-the-spec.md), now describing work partly already
  landed.
- Facts baseline: census.md in this directory (2026-08-22, HEAD e6433bce).

## Decisions so far

<!-- one line per closed ticket -->

- **The row controls leave the row** (2026-08-22, direction taken on
  [02](issues/02-one-render-path.md)) — grip, drop indicator and menu move out
  of the row element into one per-editor layer. Four of six adversarial passes
  proposed it independently; no proposal contained it. Unmeasured, so
  [04](issues/04-adapter-convergence.md) is re-scoped as its prototype and the
  blocking edge is inverted: 02 constrains 01, not the reverse.
- [Row-controls-layer prototype](issues/04-adapter-convergence.md) — **CONFIRMED WITH
  CAVEATS**. Geometry tracks at drift 0 in all seven cases; the row genuinely
  becomes its own child-sequence host behind ONE self-gating line in `bind.ts`,
  killing both the extra span and the custom-`slots.block` freeze hazard; the
  feared 2N fan-out does not exist at HEAD either, and mount drops 44→18 ms /
  1005→403 DOM nodes / 201→1 control roots at N=200. Two hard requirements it
  produced: the hovered row must be PINNED on the grip's mousedown or drag
  never starts, and the pin may not use a `document` listener. Honest cost:
  React line count is roughly flat — the reduction lands on the second adapter.
  Asset: branch `prototype/chrome-layer` (`4e041dd0`). Follow-on decisions
  taken the same day: the layer lives INSIDE the container (a new wrapper
  element in `MarkedInput` would impose a published DOM change on every
  consumer), and `alwaysShowHandle: true` is redefined as "one grip, on the
  row nearest the pointer" — a declared behavior change on a published option,
  since one layer cannot render 201 always-visible grips.
- [The hover pin releases itself](issues/04-adapter-convergence.md) — the
  maintainer challenged "the pin cannot use a document listener" and was right.
  No stated reason for that rule exists anywhere; the assertion behind it is a
  deletion pin from the one-host migration, it encodes a call SHAPE that
  `{capture:false}` walks past, and core already ships a document `mousedown`
  in `BlockStore.attachMenu`. Better still, the scope the prototype shipped
  instead — container `mouseup` — is measurably broken (press the grip with
  `draggable:false`, release outside, the layer wedges forever). The answer
  attaches NOTHING: the pin expires inside the one handler that reads it.
  `SelectionDriver.spec.ts:328-343` is amended to assert the two properties
  that actually survived — mount takes no page-wide pointer stream, and unmount
  gives back what it took.
- [The component surface](issues/02-one-render-path.md) — **PAUSED 2026-08-23,
  direction taken.** The 2026-08-22 decision (a `slots` registry keyed by node
  kind, absorbing `props.Mark`) was REVERSED: it let internals dictate the
  public API. Measured, `Mark=` appears 73 times against `slots=` 9, and flat
  props are already the house convention — `Mark`, `Span` and `Overlay` sit at
  top level while only `container` and `block` are in `slots`. New direction:
  `slots`/`slotProps` dissolve into `Container`, `Row`, `containerProps`;
  `Mark={Tag}` is untouched. The internal-vs-content boundary `slots` was meant
  to draw does not hold today anyway — `Overlay` overrides an internal component
  and is already flat — so the distinction moves into names plus a new
  `CONTEXT.md` **Slot** entry. Two sub-questions open: `Row` versus `Block`, and
  whether `Overlay` is renamed. Not to be started without reopening the
  discussion.
- [One input pipeline](issues/03-one-input-pipeline.md) — shape A (one listener
  pair, block arms after the shared checks) plus a row-separator expansion in
  `anchorsForDelete`, without rewriting `stepAnchor`. Ranged-Enter options C and
  D died on a measured regression. The 46-line row tier is now GONE in full —
  `rowEdgeAnchors` + `rowOfAnchor` looked load-bearing only because a TEST HELPER
  manufactured their input: storybook's `setCaretPosition` matched a zero-length
  text node at offset 0 and parked the caret on Vue's `v-for` fragment anchor. One
  line in `focus.ts` removed all 6 vue hits; the 7th was hand-built and is deleted
  with the tier. BEHAVIOR CHANGE declared there: Backspace with no resolvable DOM
  caret is a no-op instead of merging on a fabricated caret index of 0.
- [No user reaches a row-interior boundary](issues/03-one-input-pipeline.md) —
  MEASURED in a real browser, both projects. A real Backspace after a real blur
  never reaches the container's keydown at all (focus is outside it), and
  `rangeCount` stays 1 across a blur, so "no window selection" does not occur.
  Dispatching the keydown by hand after a real blur confirms `SelectionDriver`'s
  `focusout` microtask has already cleared the stored anchors. The
  `domBoundary.ts` gap in the round-1 list below is therefore real but
  UNREACHABLE from input — it stays a recorded defect, not a blocker.
- [The row-controls layer is BUILT](issues/04-adapter-convergence.md) (2026-08-22) —
  one editor-level `BlockController` + one `BlockControls` per adapter, with
  `BlockStore`, the per-row controller and the three per-row control components
  deleted. ADR-0007 carries the amendment it owed: the controls are addressed
  by POSITION, a Row's own state still travels with the Row. Declared behavior
  changes: geometric hover AND drop (the gutter and the gap between rows now
  answer with the nearest row, where DOM containment answered nothing),
  `alwaysShowHandle` redefined, `BLOCK_MENU_ITEMS.run` takes the controller,
  `store.block`'s row verbs are now `addRow`/`deleteRow`/`duplicateRow`
  addressed by the open menu's row, one extra `contenteditable="false"`
  container child, and a dead row's menu verb now refuses. The grip band stays
  anchored to its ROW, so it hangs left of the text with or without core's
  gutter. NAMING, settled 2026-08-23: the class shipped as `ChromeModel`, was
  renamed to `ChromeController`, and landed as `BlockController` — the word
  "chrome" was rejected because it collides with Chromium, which this repo
  discusses constantly, and because `block` was already the glossary's word.
  `store.block` therefore SURVIVES rather than being replaced, so the published
  break is smaller than the intermediate commits suggested. The prototype
  record ([04](issues/04-adapter-convergence.md)) keeps the prototype's own
  names on purpose: its line references are to the file as it stood on branch
  `prototype/chrome-layer`.
- [Stale premises](issues/07-stale-premises-sweep.md) — the filter is gone; 9
  stale sites fixed (the census found 3), backlog 09 and 15 both closed as
  non-reproducing, and `anchorAt`'s `side` param is now measured
  production-dead.

## Not yet specified

- Verb-set convergence details (does a Row ever need `update()`; does
  `mergeWith` stay row-only) — sharpens after 01/02.
- Migration order for the implementation — belongs to the spec (08).
- Storybook Drag page reshaping (name, shared-spec harness) — after 04.
- Whether the `attachMenu` document `mousedown` and `OverlayController`'s
  capture-phase document `click` want the same treatment as the hover pin —
  they are interaction-scoped global listeners, legitimate under the amended
  assertion, but nobody has asked whether they need to be global either.
- Fate of published `slots.block` / `slotProps.block` names — after 02's slot
  registry sub-question; glossary says "not a rename target", and
  `slotProps.block` typechecks on neither adapter today.

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
- ~~**ADR-0007's body says `BlockController` prunes per-row state by node id.**
  It does not prune at all; `BlockController.ts:11-25` argues object keying is
  chosen precisely so no prune is needed. Stale ADR text.~~ CLOSED by the
  controls layer's ADR-0007 amendment, which names the per-row class as deleted; the
  original paragraph stays as the record of the state at the time.
- **`blockEdit.ts:48-66` justifies the stored-selection tier with a
  `pendingStructural` window that ADR-0008's own 2026-08-19 amendment says no
  longer exists.** The tier is still load-bearing; the written reason is dead.
- **`anchorAt`'s `side` parameter is production-dead** — measured, one
  hand-assembled test holds it up. A signature change, so it needs its own yes.
- **A boundary on a slot mark's own presentation wrapper declines, and the
  keystroke is dropped** — **CONFIRMED and FIXED.** `domBoundary.ts:99` asked
  `hasEditableAncestorBefore`, which read the INHERITED `isContentEditable`; a
  slot mark's root, its slot host and every consumer element between them go
  BARE by design (`bind.ts`'s `applyEditableState` freezes only the path's
  SIBLINGS), so the guard answered true for the mark's own presentation,
  `domAnchors()` declined and `dropUnexpressedInput` cancelled the key. The fix
  drops the inherited disjunct, leaving the `contentEditable` PROPERTY test —
  identical in meaning to `beforeInput.ts`'s `inExplicitEditableIsland`, which
  the two walks now share. Two corrections to the filing above: the TRIGGER is
  not "a list row whose first content is a mark" (row 3, a slot-mark-first row,
  always typed) but a BLOCK-box presentation wrapper with own pixels plus a
  caret-unreachable `ce=false` atomic as the slot's first child — the shipped
  `code` and `strikethrough` presets; and it is not the "editable marks never
  worked" area but a regression from the one-host migration (#274 moved
  `contenteditable=true` onto the container and left `textOffsets.ts`
  byte-identical, flipping the guard's premise). Pinned by `Drag.spec`'s
  "Feature: typing on a list mark own padding" (both adapters) and
  `domBoundary.spec`'s inherited-editable case. BEHAVIOR CHANGE declared: that
  click plus a key now inserts at the mark's NEAR EDGE, so the row un-lists
  (`XCode snippets and code blocks`) instead of the key evaporating.
- **A row-interior DOM boundary resolves to nothing** — `anchorFromBoundary`
  has arms for the container, a text surface, `node === tokenElement` and
  `owner.kind === 'mark'`, none for a node INSIDE a row. New with ADR-0009 /
  #291, which deleted the explicit `rowElement` arm while Vue's `Block.vue`
  gained `v-for` fragment anchors. Latent: no user reaches it (~5100
  `caretPositionFromPoint` probes plus every gesture and every core-driven
  placement hit it zero times) and core cannot produce it, since
  `DomModel.#entryOf` descends a row anchor to its edge child token. Recorded
  rather than fixed: a candidate arm flips the documented contract at
  `domBoundary.spec.ts:395`, and the naive version regressed 6 → 13 because
  `childBoundaryAnchor`'s no-neighbour fallback answers `{after: row}` under
  `'nearest'` and the driver then physically drags the caret to the row's end.
  If ever wanted, it lands alone with its own gate.
- **The keydown delete arm swallowed word and line deletes.** It claimed every
  Backspace/Delete regardless of modifiers and answered with a ONE-CHARACTER
  step, so the browser never emitted the `deleteWordBackward` that carries the
  extent. Fixed in 03 rather than reported, because 03 hands block the same arm
  and a layout-scoped fix would have re-added an `isBlock` fork.
- **`dom/domBoundary.ts` has no arm for a boundary INSIDE a row's wrapper that
  lands on no text surface** — a framework placeholder (Vue anchors a fragment on
  an empty text node), the exact shape `fromContainerAnchor` exists for one level
  up. It answers `undefined`, `SelectionDriver.sync` bails on `undefined`, and
  the STORED selection silently keeps a stale offset for as long as the caret
  sits there. It was blamed for 03's row tier surviving; the real cause was a test
  helper parking the caret there, and the tier is gone. NOT reachable by any input
  path measured so far, so it is a latent gap rather than a live defect. If it is
  ever wanted it needs its own ticket with the caret fixpoint measured — a naive
  row-interior arm took vue `Drag.spec` from 9 failures to 13, because
  `childBoundaryAnchor`'s no-neighbour fallback answers `{after: row}` under
  `'nearest'` and `SelectionDriver.#applySelection` then drags the caret to the
  row's end; 4 of those 13 press no delete key at all. It also flips
  `domBoundary.spec:395`'s documented contract.

## Out of scope

- Row as parser Markup (rejected 2026-08-20, token-born-edit issue 08).
- Symmetric unification: draggable/hoverable inline marks — separate effort.
- Block-selection mode (rows-as-objects UX) — separate feature (2026-08-11).
- Shift+Enter under separator `'\n'` — ADR-0009's open sub-decision, not ours.
