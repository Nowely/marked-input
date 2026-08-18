# DRAFT — code landed on b0, not yet in a PR

The change this records is implemented and green (all five checks). It is still a draft only
because every ADR in `docs/adr/` ends with a `Full record: PR #NNN` pointer and this one has no PR
yet. Move it to `docs/adr/0008-the-id-bridge-does-not-fail-closed.md` and fill the number when the
PR opens.

---

# The id bridge does not fail closed — absence is the only refusal

`TokenModel.handle(id)` used to answer `undefined` for every id while a structural apply awaited its
bind, gated by the `pendingStructural` latch through a `CommitPipeline.pending()` accessor. The
stated reason was that the node layer is one generation stale, so a handle would let a caret command
act on a tree the DOM never showed.

The reason does not survive measurement. The caret after a structural edit lands on a NEW node, and a
new node has no handle in the node layer at all — handles are created by `bind` (`dom/bind.ts`).
`handle(id)` already answers `undefined` there, by ABSENCE. What the latch added on top was a refusal
for nodes that SURVIVED the commit, whose elements are correct during the window: the per-surface
effect has already written the new text (`commitPipeline.spec.ts`'s fold case). It refused exactly
the case that would have worked.

Removing the guard line failed one test out of 1467 — the test that pinned the latch itself. The case
worth doubting was already covered and stayed green: `Overlay.spec.ts`'s "restore focus after
selection from overlay" inserts a mark into the middle of a document and asserts the caret offset
after it, in Chromium with a real repaint.

The latch also predates the topology that removed its blast radius. It first appears 2026-06-22
(`39c721fe`, #267); the single contenteditable host is 2026-08-12 (`9f824829`, #274). Under N hosts a
premature `placeCaret` called `focusIfNeeded` and one span stole focus from another, stack-proven in
[`docs/records/one-host-migration.md`](../../records/one-host-migration.md). Under one host
`focusEditingHost` targets the container, which already holds focus, so a premature placement is a
no-op or a transient the post-bind `tokens.changed` re-apply corrects in the same frame.

**Decided:** the id bridge answers whatever the node layer holds. A node with no handle refuses; a
node with a handle answers. There is no second, flag-shaped refusal. `CommitPipeline.pending()` is
removed with it — the accessor had no other consumer.

`pendingStructural` itself STAYS, as what it always was underneath: commit routing. While a
structural apply awaits its bind every later apply folds into it and announces with it
(`dom/commit.ts`'s fold guard). Only the accessor and the refusal it fed are gone.

New gate: `seam/pendingWindow.spec.ts` states the invariant a latch-free bridge has to hold — a caret
requested mid-window is correct once the bind lands — over a KEYED repaint fixture, because the
shared fixtures rebuild every element on every paint and so cannot observe a caret surviving one.
`TokenModel.spec.ts`'s latch case was replaced by the new contract: a surviving node keeps its
handle through the window, a node born by the commit has none until its bind.

Accepted costs, each checked rather than assumed:

- **A mid-window caret at a surviving MARK's boundary** reads `parent.childNodes.indexOf` in the
  pre-paint DOM. The `tokens.changed` re-apply corrects it after the bind; the transient is accepted,
  not eliminated. Gated by `pendingWindow.spec.ts`.
- **`OverlayController` anchors its popup to the previous element** instead of falling back to
  `document.body` (`overlay/OverlayController.ts`, `#findTrigger`). Narrower in practice than it
  first looks: the probe's main clock is `tokens.changed`, which fires only after the bind, so the
  window is reachable only through the `selectionchange` arm. Better in substance either way — the
  popup shifts by a frame rather than jumping to a screen corner — but it is an observable change.
- **Composition/IME is unaffected**, checked rather than waved through: `keyboard/beforeInput.ts`
  lets a non-cancelable `insertCompositionText` pass and expresses no edit for it, so composition
  opens no commit and therefore no window. The suite's lack of composition coverage is a real gap
  and a pre-existing one; this decision neither widens nor closes it.

Explicitly unchanged, so this is not read as more than it is:

- Node WRITES stay ungated. The S1.6d inversion stands and reintroducing a write latch remains a
  SEMVER-MAJOR reversal (`tree/markNode.spec.ts`).
- Element-first resolution stays ungated mid-flight — `handleAt`, `anchorFor`, `domAnchors` keep
  answering from the painted DOM (decision S2 D4).
- `renderEpoch`, `onRendered` and `bind`'s walk are untouched. **This does not remove the commit
  pipeline.** Those three are the invoice for framework-owned DOM and come off only by moving
  ownership ([ADR-0007](../../adr/0007-row-identity-travels-with-the-row.md)).

Full record: PR #TBD. The long-form analysis, including the options this was chosen over, is
[`architecture.html`](architecture.html).
