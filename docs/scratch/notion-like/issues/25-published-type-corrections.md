# Two published types are wrong at the boundary

Type: task
Status: needs-triage
Blocked by: —

## Problem

`insights.md:107-112`:

> **8. Two published types are wrong at the boundary.** `OverlayHandler.ref` is
> `RefObject<HTMLElement | null>`, unassignable to any concrete element ref — the repo works around
> it in two places and the docs cast in eight. `MarkedInputProps.Span` is
> `ComponentType<MarkProps>`, but a Span component is handed a `ref` that `MarkProps` does not
> declare.
> **Honest fix: types, and it is a decision rather than a task** — both are published corrections,
> so they want a maintainer's yes rather than an afternoon.

Verified at `52ef65ae`:

- `packages/react/markput/src/lib/hooks/useOverlay.tsx:38` — `ref: RefObject<HTMLElement | null>`,
  with the Vue twin at `packages/vue/markput/src/lib/hooks/useOverlay.ts`.
- `packages/react/markput/src/components/MarkedInput.tsx:32` — `Span?: ComponentType<MarkProps>`,
  while `MarkProps` (`packages/react/markput/src/types.ts:15-22`) declares `value`, `meta` and
  `children` and no `ref`.

## Why it matters here

`outcome.md`'s item 28 counts the workarounds: two in the repo, eight casts in the docs. Every one
of them is a consumer meeting a type that is wrong, and the doc-sample harness now type-checks
those casts, which freezes the workaround into the documentation.

## Cost

Two type changes and their DTS diff. It ranks last on `outcome.md`'s own list (`outcome.md:580-582`) *"not
because it is unimportant but because it is a decision, not a task"*.

Related and already ticketed by the probe, both still open and both one line each: `Store` is
published from `@markput/core` and from neither adapter ([03](03-row-node-not-nameable.md)'s open
half), and `useMarkput(s => s.rows)` does not compile ([10](10-controllers-are-not-selectable.md)).
`insights.md:366-371` groups all three as one afternoon.
