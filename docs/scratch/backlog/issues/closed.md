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
