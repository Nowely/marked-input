# Backlog

Work that is known to be needed, with the evidence that says so. Nothing goes in without a measurement; nothing stays in once its commit lands.

Read in order: what is blocked on the maintainer, what can be picked up today, what needs a measurement before anyone decides, and what is closed so it is not proposed again.

Context for every item below: PR #274 moved the editor to a single `contenteditable` host and block onto tree anchors. `docs/one-host-migration.html` holds the design and the post-migration measurements; `packages/website/.../development/inconsistencies.md` holds the behaviour differences from a native field.

## Blocked on a decision

**Editable mark values.** A mark's own text has never been editable, on any branch: a `contenteditable` nested inside another editable element is not its own editing host, so a consumer's `onInput` never fires. Core has to own it — keep a consumer-declared attribute, exempt the island on both guard tiers, stop pulling the caret out of it, route the edit into `mark.update({value})`. Choose the last step: compute the new value from the event (keeps the DOM out of the value; recommended) or read the element's text back afterwards. Unmeasured: whether the caret survives the re-parse. One medium task plus an edge-case pass.

**Click selects the mark.** Clicking an atomic could select it whole — highlight, Backspace deletes — instead of placing a caret at its nearest edge. New behaviour, not a fix. Decide together with the parked block-selection mode.

## Ready to pick up

Independent of each other; smallest first.

**Forward Delete at a row start merges backward.** It runs the Backspace branch, so it merges row N into N−1 instead of pulling N+1 up. Reachable since cross-row caret movement became native.

**Three caret conventions for a new row.** Drag-add lands at the row start, Enter on a mark row after the inserted content, select-all + Enter at offset 0. One rule should hold: inside the fresh row's slot.

**The grip gutter ignores `draggable: false`.** The 24px gutter is reserved only when `draggable` is set, but the grip renders in block mode regardless — it is the menu trigger — so it sits outside the padding.

**`api.focus()` can focus nothing.** `placeAtHandle` reports success even when the placement declines, so `focusFirst` returns without its container fallback. Public surface: the behaviour change needs sign-off with the fix.

**Selection write asymmetry at mark boundaries.** A caret at a mark's start costs two DOM selection writes per mousedown, at its end one. Harmless today, but the same churn broke drag selection once already. The fix is to skip a re-place that would not move the caret — a hot path, so pin it before changing it.

**Two coverage gaps.** The vue `draggable: false` grip path has no test. Two rows in `inconsistencies.md` (Shift+Arrow, focus/blur counts) are labelled inference rather than measurement.

## Measure first

**Block gap caret.** Block mode filters the empty bracket tokens, so deleting the only character between two adjacent marks leaves the caret at the document end instead of the deletion site. Three candidate designs; the third changes block's address space, so it is a maintainer call. Produce the comparison table first.

**Native select-all escaping a consumer island.** The model correctly stays out, but the native chord moves focus to the container with a collapsed caret at document start. Probe Chromium's behaviour with nested hosts, then choose between scoping it and documenting it.

**Invisible highlight on mark-first value documents.** Select-all yields a non-collapsed selection whose text is empty; typing still replaces. Reproduce and diagnose.

**The two pinned adoption failures.** `adopt.spec` pins two wrong adoptions — an in-slot deletion kills the wrong sibling of two identical marks. The slot recursion's window bound was designed and never implemented. Write the reproduction and the options; flipping those pins is a decision, not a task.

## Closed

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
