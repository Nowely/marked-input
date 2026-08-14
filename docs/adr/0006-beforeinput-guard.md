# A fail-closed `beforeinput` guard instead of a `MutationObserver`

Editors built on one contenteditable host usually reconcile the DOM the browser edited, via a `MutationObserver` — that is what CodeMirror 6 does. markput does not need to: every input path already runs `preventDefault()` and writes through `edit.replace()`, so nothing legitimate mutates the DOM behind the model's back. The guard cancels every unhandled cancelable input type, which means the browser never edits DOM the model owns, and the observer is unnecessary.

What it deliberately does not cover: IME, because `insertCompositionText` is not cancelable — composition stays unhandled by design. Native undo/redo are swallowed by the guard; they were already dead in both topologies, measured, so this removes nothing that worked.

Full record: [`docs/records/one-host-migration.md`](../records/one-host-migration.md).
