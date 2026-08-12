# markput — plan

One place for what is done and what is next. Intent and evidence only; the code-level detail lives in the commits.

## Where things stand

The editor moved from N contenteditable hosts (one per text token) to ONE editing host — the container — and the block feature moved onto tree anchors with it. PR #274 (`b0` → `next`), 22 commits, core +2879/−1233. All suites green: 1391 passed / 7 todo across 70 files.

The design, the measurements it was built on, and a post-migration verification addendum are in `docs/one-host-migration.html`. `packages/website/.../development/inconsistencies.md` is re-measured against the new core.

What it bought: the click steal is gone (a click from one span into another never moved the caret before), cross-mark selection and delete work, Tab leaves the field, Home/End and word navigation cross the whole line, cross-row caret movement is the browser's. What it cost is listed as breaking changes in the PR.

Two known limits, both control-measured: triple-click cannot select a whole line, because Chromium bounds paragraph selection at any inline `contenteditable=false`; and the parser-guaranteed empty token between adjacent marks renders 0px wide, so it is reachable by arrows but not by mouse.

## Decisions needed

**Editable mark values.** A mark's own text has never been editable, on any branch — `contenteditable` nested inside another editable element is not its own editing host, so a consumer's `onInput` never fires. Making it work means core owns it: keep a consumer-declared attribute, exempt the island on both guard tiers, stop pulling the caret out of it, and route the edit into `mark.update({value})`. Two shapes to choose between: compute the new value from the event (keeps the DOM out of the value, recommended), or read the element's text back after the browser edits it. Open question either way: whether the caret survives the re-parse. Size: one medium task plus an edge-case pass.

**Click selects the mark.** Clicking an atomic could select it whole (highlight, Backspace deletes) instead of placing a caret at its nearest edge. New behaviour, not a fix; decide together with the block-selection mode that is already parked.

## Defects — measured, independent, small

- **Forward Delete at a row start merges backward.** It runs the same branch as Backspace, so it merges row N into N−1 instead of pulling N+1 up. Reachable since cross-row caret movement went native.
- **Three caret conventions for new rows.** Drag-add lands at the row start, Enter-on-a-mark-row after the inserted content, select-all + Enter at offset 0. One rule should hold: inside the fresh row's slot.
- **`api.focus()` can focus nothing.** `placeAtHandle` reports success even when the placement declines, so `focusFirst` returns without its container fallback. Public surface — needs sign-off with the fix.
- **Grip gutter with `draggable: false`.** The 24px gutter is reserved only when `draggable` is set, but the grip now renders in block mode regardless (it is the menu trigger), so it sits outside the padding.
- **Selection write asymmetry at mark boundaries.** A caret at a mark's start costs two DOM selection writes per mousedown, at its end one. Harmless today, but the same churn class broke drags once. The fix is a re-place skip: do not rewrite a selection that already means the same position. Hot path — pin first.
- **Missing coverage:** the vue `draggable: false` grip path has no test; two rows in `inconsistencies.md` (Shift+Arrow, focus/blur counts) are still labelled inference rather than measurement.

## Investigations — measure before deciding

- **Block gap caret.** Block mode filters the empty bracket tokens, so after deleting the only character between two adjacent marks the caret resolves to the document end instead of the deletion site. Three candidate designs; the third changes block's address space, so it is a maintainer call. Produce the table first.
- **Native select-all escaping a consumer island.** The model correctly stays out, but the native chord moves focus to the container with a collapsed caret at document start. Probe Chromium's behaviour with nested hosts, then choose between scoping it and documenting it.
- **Invisible highlight on mark-first value documents.** Select-all gives a non-collapsed selection whose text is empty; typing still replaces. Reproduce and diagnose.
- **The two pinned adoption failures.** `adopt.spec` pins two wrong adoptions — an in-slot deletion kills the wrong sibling of two identical marks. The slot recursion's window bound was designed and never implemented. Write the reproduction and the options; flipping the pins is a decision, not a task.

## Out of scope for now

- **Controlled-mode echo machinery** (plus its two measured defects: two edits in one task lose the first character; typing a character equal to the following text leaves the caret before it). Maintainer: not now.
- **ARIA / `role="textbox"`.** Maintainer: not interesting.
- **Editor-owned undo history.** Undo is dead in both topologies and the guard swallows the native chords; restoring it needs its own design.
- **IME / composition.** `insertCompositionText` is not cancelable; unhandled by design.
- **Replacing the hand-rolled signals.** Breaks the dependency-free promise of `@markput/core`.
- **Adapter deduplication.** React and Vue are ~90% the same, but their suggestion keyboard handling genuinely differs — a semantics decision, not a move.
- **`prepack.js` overwriting the Vite build.** Its own issue.
- **Block-selection mode** (rows as objects).

## How this work runs

One task per commit, each green on its own. Every task gets two independent reviews — does it match what was asked, and is it built well — with mutation evidence that each new test actually catches its own bug. That discipline caught ten defects the tests missed during the migration, including a guard that failed open in production while passing every pin.
