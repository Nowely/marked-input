# Closed

Status: wontfix

Not open for re-proposal without new evidence.

- **Controlled-mode echo machinery**, including its two measured defects (two edits in one task lose the first character; typing a character equal to the following text leaves the caret before it). Maintainer, 2026-08-12: not now.
- **ARIA / `role="textbox"`.** Maintainer, 2026-08-12: not interesting.
- **Editor-owned undo history.** Undo is dead in both topologies and the guard swallows the native chords; restoring it is its own design.
- **IME / composition.** `insertCompositionText` is not cancelable; unhandled by design.
- **Replacing the hand-rolled signals.** Breaks the dependency-free promise of `@markput/core`.
- **Adapter deduplication.** React and Vue are ~90% the same, but their suggestion keyboard handling genuinely differs — a semantics decision, not a move.
- **`prepack.js` overwriting the Vite build.** Its own issue.
- **Block-selection mode** (rows as objects). Approved as a later feature.
- **Triple-click selecting a line** and **clicking the empty gap between two marks**: Chromium limits, control-measured without markput. A filler for the gap stays rejected — it reaches the clipboard.

## Idea sweep of 2026-08-15

A batch of maintainer notes triaged against the tree. What survived is issues 19-27; the rest
is here.

- **"Extract explicit layers."** Already done: `parser/ → tree/ → dom/ → seam/` with a stated
  no-upward-edge rule (`features/tokens/README.md:20-30`). The one residue — `block/operations.ts`
  as a second row-array manager — is a `core-layers` question, not backlog work.
- **"Refactor controllers into feature-based modules."** Already true: every controller sits in
  its feature directory (`features/block/BlockController.ts`, `clipboard/`, `edit/`, `keyboard/`,
  `overlay/`).
- **"Audit the core package."** Done and re-verified 2026-08-14 — see the section below.
- **"Inline Storybook if only one package uses it."** Already true: every `@storybook/*` dep is
  pinned in `packages/storybook/package.json` and no package depends on `@markput/storybook`.
- **"Remove `useStore` from the public API."** It is not public — React has no such hook, and
  Vue's is not exported from its `index.ts`. Migrating the Vue components off it survives as a
  `core-layers` task, but no published contract is involved.
- **Flat-only optimization mode.** False premise: nesting is already short-circuited at every
  layer — `dom/bind.ts:155-156` returns before descending on zero children, `Token` renders the
  children wrapper only when there are children, and no parser is built without markups
  (`TokenModel.ts:418`). The only residue is `#childSequenceHostsFor` (`TokenModel.ts:578`), a
  linear scan over a registration map that is empty for flat documents; making it a Map is a
  nested-only micro-fix that needs a benchmark first, and the repo's only bench is
  `parser.bench.ts`.
- **Lazy-attach `contentEditable` only when focused.** Rejected, but not for the reason first
  written: per-node `contenteditable` writes *do* exist — `dom/editableState.ts:34` freezes each
  value-only mark root and `:47-49` freezes every control sibling on the slot-host→root path,
  applied per newly bound node from `applyMountState` (`dom/bind.ts:203-217`). They are atomicity
  markers rather than the host's editability, and they have to be in place whenever a mark is
  bound, focused or not. The host's own attribute is written at mount and thereafter only when
  `readOnly` changes (`SelectionDriver.ts:47-56`). What kills the proposal is `focusEditingHost`,
  which finds the host *by* `[contenteditable="true"]` (`dom/caret.ts:106`): defer that and every
  model-initiated placement breaks, `api.focus()` included. It would deepen issue 06, not
  optimise anything.
- **"Fix incorrect content replacement inside nested mark spans."** Duplicate of issue 12, with a
  correction: content is never carried over — retained nodes are rewritten from the parse
  (`tree/adopt.ts:110-135`), and the property suite asserts the projection equals a fresh parse.
  The defect is *identity*: the wrong sibling's node is dropped.
- **"Fix content overwrite on the flat-to-nested transition."** Fixed in #220 and pinned
  (`Base.spec.ts:41`, `dom/bind.spec.ts:585`). Chasing it did surface a real Vue-side defect,
  which is issue 25.

## Core audit of 2026-05-23, re-verified 2026-08-14

Nine of that sweep's twelve items no longer exist — the core was inverted twice (`a558bf44`, `36a621c8`) and re-topologised once (#274) after it was written. The record itself is at `git show 1601fa26:docs/scratch/core-audit/README.md`. Its three survivors: `createRowContent([])` was fixed in the same commit as this entry, and the other two are issues 13 and 14.

- **Block keyboard infers rows from DOM child order.** Killed by #274 — row identity comes from the selection. `keyboard/blockEdit.ts:65-66` is now a comment about the tier that used to read `document.activeElement`.
- **Container listeners are one-shot.** Fixed inside `Host.onMounted` (`state/Host.ts:18-24`): it watches the container signal, disposes the previous scope and rebinds — which is the fix the audit proposed. Two of its five cited sites (`keyboard/arrowNav.ts`, `selection/SelectionController.ts`) are gone outright.
- **Overlay ships a fake `MarkToken`.** `overlay/createMarkFromOverlay.ts` deleted.
- **Overlay trigger probing reads global selection.** `overlay/TriggerFinder.ts` deleted; `#findTrigger` reads this editor's own `tokens.selection.anchors()`, so the cross-editor latch it described cannot happen.
- **Stale feature READMEs.** `dom/README.md` and `parsing/parser/README.md` deleted; `clipboard/README.md` names `ClipboardController` correctly; `slots/README.md` re-read clean.
- **`features/parsing/preparsing/`** — directory gone.
- **`Parser` static + transform/escape API** — gone; `features/tokens/parser/Parser.ts` has no `static`, `transform`, `escape` or `stringify`.
- **`DomBoundaryHost` / `DomIndexerHost`** — no longer in the tree.
- **`Lifecycle.onMounted` orchestration** — the `Lifecycle` class is gone; the host owns `onMounted`.

## Closed 2026-08-18

- **Issue 28 — "Announce the commit delta as a set difference, not an accumulator."** DONE. The
  maintainer's call came in as the follow-on to the pending-window work; the proposal's own caveat
  ("the subset was never measured alone") is now discharged — the subset was implemented and
  measured by itself, and the accumulator's evidence held: **zero spec edits** to make it green.
  `pendingDelta`, `foldDelta`, `drainDelta`, `deltaOf` and its subtree walk are gone;
  `BindResult.ids` is the one new field. `TokenDelta`'s array ORDER changed as declared, content
  did not.

  One thing the proposal did not predict, found by mutation testing rather than by reading:
  `updated`'s `∩ announced` clause — the rule that keeps one id out of `added` and `updated` at
  once — was covered by NO test, in the accumulator either. Deleting it left all 989 core tests
  green. It now has one (`commitPipeline.spec.ts`, "a mark born and then EDITED inside one window
  is announced as added only"). The `removed` half was already mutation-sensitive: emptying it
  reds three cases.

## Closed 2026-08-22

Both closed by the row/mark unification map's stale-premises sweep
(`docs/scratch/row-mark-unification/issues/07-stale-premises-sweep.md`). Both rested on
the same dead premise — that block layout filters empty text tokens — which died with
`parser/utils/filterEmptyText.ts` in #291.

- **Issue 09 — "Block gap caret."** Closed 2026-08-22 — does not reproduce. The premise died with `parser/utils/filterEmptyText.ts`, deleted in #291 when block layout cut over to RowNodes; `RowBuilder.groupRows` now guarantees the opposite, and the parser still puts an empty text token between two adjacent marks.

  Measured on `@[a](1)X@[b](2)` in block layout, separator `'\n\n'`: deleting the `X` (`applyRange({start: 7, end: 8, insertedLength: 0}, '')`) repairs the caret to `text[7,7]+0` — offset 7, the deletion site. The row after the delete is `row[0,14]{text[0,0], mark[0,7], text[7,7], mark[7,14], text[14,14]}`. Inline layout on the same value answers identically, so there is no block/inline divergence left to compare and no design table owed.

  What survives is a different item: that caret position sits on a 0px bare gap span, so it is arrow-reachable but not clickable (ADR-0004). See `28-caret-defects-nobody-wrote-down.md`.

- **Issue 15 — "A block row whose slot starts with a mark never opens."** Closed 2026-08-22 — moot in every form, verified by measurement.

  **The repro no longer registers.** `new Parser(['__slot__\n\n', '@[__value__]'])` throws
`Invalid markup: "__slot__\n\n". A markup must not begin with a placeholder — the row separator is an editor-level setting, not part of any markup` (`MarkupDescriptor.validateMarkup`, ADR-0009 / #295). A row is not a markup any more, so the shape the issue is about cannot be built.

  **The defect does not survive in the legal shape.** The same document expressed the ADR-0009 way — rows from `props.separator` — opens the mark-first row:

  ```
parseRows('@[x]\n\nplain', '\n\n')
  ROW "@[x]↲↲" [0-6] term=true   TEXT "" [0-0] | MARK "@[x]" [0-4] | TEXT "" [4-4]
  ROW "plain"  [6-11] term=false TEXT "plain" [6-11]
```

  A slot whose content starts with a mark parses too: `#[@[x] tail]` nests as `mark[0,12]{text ""[2,2], mark "@[x]"[2,6], text " tail"[6,11]}`.

  **The trailing note is permanently false, not pending.** It said `tree/anchors.spec.ts`'s nested-first test could stop assembling its tree by hand "once this is fixed". Every legal markup now begins with a literal segment, so a nested mark can never be flush with its parent's start and that shape is unparseable by design. The test's own comment already says exactly that.
