# No zero-width-space fillers in the empty gaps between marks

The parser guarantees an empty `TextToken('')` around top-level marks, and the assumption was that reaching that position required a ZWSP filler. Probing the committed DOM shape showed it does not: a bare empty `<span>` yields element-anchored caret positions — `gapSpan:0`, `DIV:2`, `editor:0` — which `anchorFor` already resolves through its element-boundary arm and `fromContainerAnchor`. A filler was rejected because it is real text: it reaches `range.toString()` and contaminates the clipboard, and it costs the user a second arrow press to cross one gap.

Consequence measured after shipping: the bare gap span computes to 0px wide, so the position is arrow-reachable but not clickable. That was accepted over clipboard contamination. One invariant this depends on — container child index maps 1:1 to root index, so empty text tokens must keep rendering their bare `<span>`.

Full record: [`docs/records/one-host-migration.md`](../records/one-host-migration.md).
