# Removing the pending window

The maintainer's primary goal, stated 2026-08-18: *"отказ от всяких пендинг и прочего"* — get rid
of the pending window and its machinery.

Start here. Everything below is measured; nothing needs re-deriving. The long form, with the
seam map, the echo protocol and every option costed, is [`architecture.html`](architecture.html).

## Status — O6 has LANDED on b0 (uncommitted)

The id gate is gone and `CommitPipeline.pending()` with it. All five checks green: 75 test files /
1471 tests, build, typecheck, lint, format. The decision record shipped as
[ADR-0008](../../adr/0008-the-id-bridge-does-not-fail-closed.md); its closing note records what has
moved since, including the deletion of the window this whole spec is named after.

Since then, and in the same style — delete, then measure — three more items landed: the delta
accumulator became a set difference (backlog 28, closed), the delta ledger came out of `commit.ts`
as a DOM-free module with its own spec, and Vue's two announcement sites became one.

**The atomicity measurement is DONE, and the answer is yes** — though its headline consumer, O1,
was rejected the day after it ran, so what it still buys is the WRAPPER variant of O2, where the
adapter renders the wrapper and core only takes a ref. A control experiment in
Chromium — plain DOM, no markput — puts `ce=false` on the consumer's mark element, on a core-owned
wrapper, and on that wrapper at `display: contents`. All three are identical: the caret cannot step
in (`ArrowRight` never lands inside) and `Shift+ArrowRight` swallows the mark whole. A fourth shape,
a SLOT mark with a bare root, behaves differently — the caret enters and the selection grows by the
chrome character — which is what proves the probe discriminates rather than answering "atomic" to
everything. Moving `ce=false` onto core's own element therefore costs nothing, and `display:
contents` does not weaken it.

The probe was deleted after recording: it measures Chromium, not markput, and guarding an unbuilt
design with a permanent test is speculative.

## Why it came out — the measurement

`TokenModel.handle` was the latch's only production consumer. Remove the guard line and run the
whole suite:

| | files | tests |
| --- | --- | --- |
| baseline, latch in place | 74 / 74 | 1467 ✓ |
| latch removed | 73 / 74 | 1466 ✓, **1 ✗** |

The single failure is `TokenModel.spec.ts:242` — the test that pins the latch itself. Nothing else
in 1466 tests notices, including the React and Vue browser suites with real repaints in Chromium.

**Why it holds.** The caret after a mark insertion lands on a NEW node. Before `bind` that node has
no handle in `#nodes` at all — handles are created by `bind` (`bind.ts:86`) — so `handle(id)`
answers `undefined` by ABSENCE, not by the latch. Fail-closed is already structural. What the latch
adds on top is a refusal for SURVIVING nodes, whose elements are correct during the window anyway:
the per-surface effect has already written the new text, pinned at `commitPipeline.spec.ts:323`.

The case worth doubting is covered and green without the latch: `Overlay.spec.ts:217` inserts a mark
into the MIDDLE of a document and asserts the caret offset after it, in a browser.

**Why it was there.** `pendingStructural` first appears 2026-06-22 (`39c721fe`, #267). The move to a
single contenteditable host is 2026-08-12 (`9f824829`, #274). The latch was designed in the N-host
world, where a premature `placeCaret` called `focusIfNeeded` and one span stole focus from another —
stack-proven in `docs/records/one-host-migration.md:43-49`. Under one host `focusEditingHost` targets
the container, which already has focus. The latch outlived its blast radius.

## What the window is, now

`pendingStructural` in `features/tokens/dom/commit.ts` is still there and still spans a structural
apply to its bind — but it is **commit routing only**: while it is set, every later apply folds into
the pending structural pass and announces with it. It is no longer readable and no longer refuses
anything. The `pending()` accessor is gone.

- **The window only exists for STRUCTURAL commits.** A text keystroke routes around it entirely, at
  zero component renders (`renderCount.spec.ts`).
- **All six `handle(id)` call sites are caret/selection**, plus one overlay anchor: `DomModel.ts`
  (twice), `SelectionDriver.ts`, `blockEdit.ts` (twice), `OverlayController.ts`. That census is what
  made the gate's removal a bounded question rather than an open one.
- **`blockEdit.ts` still works around the window by hand** ("stored anchors cover the
  pendingStructural window"). Now that the gate is gone that fallback may be dead weight — worth a
  look, not yet checked.

## The three cases that had to be closed first — all three are

1. **Transient placement in a surviving MARK's parent coordinates.** `TokenHandle.caretBoundary`
   reads `parent.childNodes.indexOf(tokenElement)` — the OLD DOM's index. **Closed** by
   `seam/pendingWindow.spec.ts`, which states the invariant over a KEYED repaint fixture: a caret
   requested mid-window is correct once the bind lands. The shared fixtures rebuild every element on
   every paint, so none of them could observe a caret surviving one — hence a new fixture.
2. **`OverlayController` anchoring.** Ungated it anchors to the previous element instead of
   `document.body`. **Declared** in the ADR rather than tested: the probe's main clock is
   `tokens.changed`, which fires only after the bind, so the window is reachable only through the
   `selectionchange` arm. Fabricating a timing-dependent test for it would assert the scheduler, not
   the contract.
3. **IME / composition. Out of scope, checked rather than waved through.** `keyboard/beforeInput.ts`
   lets a non-cancelable `insertCompositionText` pass and expresses no edit for it, so composition
   opens no commit and therefore no window. The suite's lack of composition coverage is real and
   pre-existing; this change neither widens nor closes it.

## The one hard constraint

**Node WRITES must not be gated by the window.** A mid-window `MarkNode.update()` must succeed and
fold into the pending pass. Gated by `tree/markNode.spec.ts:367` and `:391`. Reintroducing a write
latch is a SEMVER-MAJOR behaviour reversal, not a refactor.

Related, and already true: element-first resolution stays ungated mid-flight — `handleAt`,
`anchorFor` and `domAnchors` keep answering from the painted DOM while the tree is ahead. That is
decision S2 D4 and it is deliberate.

## Routes, cheapest first

- **O6 — delete the gate. DONE.** The guard line, `CommitPipeline.pending()` and the spec that
  pinned them are gone; `pendingStructural` stays as the internal fold guard it always was
  underneath. Does NOT remove the pipeline: `renderEpoch`, `onRendered` and `bind`'s walk stay.
- **O5 — move the gate to the selection driver.** Was the fallback if one of the three cases had
  turned out real. None did, so O6 superseded it. Kept here because it is the answer if a
  composition or scheduling case ever forces a gate back.
- **The delta accumulator → a set difference. DONE.** `pendingDelta`, `foldDelta`, `drainDelta`
  and `deltaOf` are gone; `bind` returns the `ids` Set it already built and threw away. Zero
  adapter files, zero published type change, and — as the proposal predicted — zero spec edits to
  make it green. `TokenDelta`'s array ORDER changed, content did not. Closed in
  [`../backlog/issues/closed.md`](../backlog/issues/closed.md).
- **O4 — split `CommitPipeline`** into "what changed" (`apply`, `changed`, delta — DOM-free and
  testable without a browser) and "has it painted" (`renderEpoch`, `onRendered`, `byElement`). Pure
  structural change. Done in the reduced form only — the delta ledger came out; the full split was
  rejected on its own terms, since it grows the interface from 6 members to 9 and its second
  adapter would have been O1.
- ~~**O1 — core builds the skeleton, the framework renders only user components**~~ —
  **REJECTED by the maintainer 2026-08-19**, verbatim: *"ядро строит скелет и тд создаст больше
  проблем"*. [ADR-0007](../../adr/0007-row-identity-travels-with-the-row.md) had deferred this;
  it is now answered no, not deferred. **Accept the consequence whole: `bind`'s walk, `renderEpoch`
  and `onRendered` stay permanently, and the commit pipeline is never removed — only shrunk.** The
  analysis is kept in `architecture.html` because it explains what framework-owned DOM costs, which
  is knowledge worth having; it is not a route.
- **O2 — register elements by ref instead of walking the painted DOM.** Not refuted as a direction;
  two of the three objections in this file's first revision were wrong and are withdrawn (see
  `architecture.html` §8). What stands: markput passes no ref to a token component today
  (`Token.tsx:57`), consumers' components are third-party or render nothing, and the only markput-owned
  wrappers are the block ROW (`Block.tsx:31-33`) and the slot host (`TokenChildren`). Its live
  remnant is worth doing on its own: the row element is registered twice, by ref AND positionally
  (`bind.ts:173-185`).
- **O3 — leave it and document the contract.** The floor, not the answer.

## Dead ends

- **Making the parse faster does not shorten the window.** The window sits between the commit and the
  bind; the parse happens before the commit. The incremental-parser branch was justified by this and
  the justification does not hold — see [`../incremental-parser/spec.md`](../incremental-parser/spec.md).
- **"Conditionally synchronous" does not close it either — but that is not an argument for the latch.**
  `EditController` writes the anchors inside the SAME batch as `apply`, and the watcher at
  `SelectionDriver.ts:66-69` places the caret in the same JS turn. Even a zero-delay repaint is a
  later turn. A native `<input>` avoids the window because the browser owns both the value and its
  shadow DOM and updates them atomically — not because it is fast. What does NOT follow is that the
  premature placement must be refused: measured, it is harmless.
- **`applyEditableState` is not a leftover.** The machinery it looks like — `isUserSelecting`,
  flipping every host to `ce=false` during a selection — existed and was DELETED whole by the
  one-host migration (~64 lines + 14 spec refs). Today's `applyEditableState` is its replacement,
  rewritten by that same commit `9f824829`, and it is ADR-0002's mechanism.
- **Deleting the whole pipeline is not available without moving ownership.**
  `@handlewithcare/react-prosemirror` inverts ProseMirror's DOM ownership so React paints, and a
  fail-closed latch reappears there (`viewDescRef.current` undefined until a layout effect), together
  with three more of markput's concepts.

## Where the evidence lives

- Long form, with the seam map and every option costed: [`architecture.html`](architecture.html).
- Commit-pipeline census — 42 hard constraints, each with the spec that reds if violated:
  `~/.claude/projects/-Users-ruliny-Git-marked-input/artifacts/commit-pipeline-removal.md`
- The four-editor analog survey (ProseMirror, CodeMirror 6, Lexical, Slate), fact-checked against
  primary sources: workflow `wf_2f9164cf-63d`.
- The N-host → one-host migration record, which dates the latch and proves its original blast radius:
  `docs/records/one-host-migration.md`.
- The arc this was originally a phase of: [`../token-born-edit/spec.md`](../token-born-edit/spec.md).
  Note that its phase ordering carries two corrections and its phase 3 was refuted by measurement.
