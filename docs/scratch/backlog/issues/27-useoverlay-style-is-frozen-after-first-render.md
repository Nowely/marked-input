# `useOverlay().style` is frozen after first render

Status: needs-info

React: `useOverlay` reads the position through `useMarkput(s => s.overlay.position())`
(`react/.../useOverlay.tsx:22`), and `useMarkput` calls the selector exactly once, guarded by a
null ref, then stores the result (`useMarkput.ts:22-26`). `position()` returns a plain object,
which `readSelected` passes straight through (`shared/readSelected.ts:22-26`), so the derived
value never changes: within one overlay session the popup cannot follow the caret. Proven from
code, unmeasured.

Vue is stale for a different reason: `const style = computed(() => store.overlay.position())`
(`vue/.../useOverlay.ts:26`) is a Vue computed wrapping a core signal read, and Vue's reactivity
does not track core's signals, so it never invalidates. Both halves are read from code; neither
is measured in a browser.

Two reasons the suite is green. The one positioning test types a single character and asserts
immediately (`Overlay.spec.ts:126-146`), so it only ever sees the first position. And the
overlay is keyed by option identity — `OverlayRenderer` keys on a `WeakMap` id for the matched
option (`OverlayRenderer.tsx:12,18`) — so a consumer passing inline option literals remounts the
overlay on every render, which re-captures the position and hides the freeze entirely. The
repro must hold the options array stable, or it will not reproduce.

Needs the browser measurement before it is a task — open an overlay with stable options, type
several more characters, watch whether the popup follows — and the fix differs per adapter.

Same keying also throws away the Suggestions active row on remount, which is worth checking
alongside issue 16.
