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
