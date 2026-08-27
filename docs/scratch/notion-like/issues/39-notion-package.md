# A published `@markput/notion` package — a move, and not yet

Type: task
Status: needs-triage
Blocked by: 03, 10, 12, 25

## Problem

`map.md:692-694` leaves the question open as the input to this whole tracker:

> What a package on top of this owns: does it wrap `MarkedInput` and ship options + components, or
> does it need core changes first? The ticket list here is the input to that decision, not the
> answer.

The answer the effort reached, `insights.md:385-391`:

> `boundary.spec.ts` already proves the showcase is options and components, so the package is a MOVE
> and not a build — which is exactly why it is not urgent, and it is why doing it now is a mistake.
> Publishing freezes an API around gestures that are still moving: rounds 8, 9, 10 and 11 each
> carried a `!` on a selection or caret rule, and item 1 above is unowned. Also, the move is not free
> of API: `Store` and the selector type (item 7) must land first or the package's consumers add
> `@markput/core` as a second dependency — which is the door `boundary.spec.ts` exists to keep shut.

## Why it matters here

It is the thing the showcase was built to prove possible, and the proof is a grep that already
passes (`packages/storybook/src/pages/Notion/boundary.spec.ts`: no import leaves the directory, no
`.edit`, no `.tokens`, no `useMarkput`). What is missing is not code; it is a stable API to freeze.

## Blocked by, concretely

- [03](03-row-node-not-nameable.md)'s open half — `Store` re-exported from both adapters.
- [10](10-controllers-are-not-selectable.md) — `useMarkput(s => s.rows)` must compile.
- [25](25-published-type-corrections.md) — the two boundary types a consumer would meet.
- [12](12-upward-mouse-selection.md) — publishing a mouse-driven editor that cannot select upward
  freezes the defect into a package's contract and its consumers' workarounds.
