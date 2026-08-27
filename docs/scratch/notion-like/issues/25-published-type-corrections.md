# Two published types are wrong at the boundary

Type: task
Status: resolved — both corrected, and the workarounds came out (2026-08-27)
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

## Answer

Both were describing what the EDITOR stores rather than what the CONSUMER is handed.

**`OverlayHandler.ref`** is now the element's own type. React's `ref` prop is invariant in the
element, so `{current: HTMLElement | null}` is assignable to no concrete element ref at all —
`useOverlay` takes the element as a type parameter defaulted to `HTMLElement`, and
`useOverlay<HTMLDivElement>()` hands back the same object with the type the consumer already knows.
The one erasure it costs lives inside the hook, where core's own storage is the reason for it,
instead of at every call site. The shipped `Popup` stops asserting its ref (its `oxlint-disable`
went with it), `Overlay.fixtures.react.tsx` stops wrapping it in a callback, and the doc casts went
from **14** — the ticket counted eight; the number had grown — to **0**. The Vue twin is untouched
and needs nothing: its `ref` is a getter/setter pair over `HTMLElement | null`, which a subtype
assigns to fine, and what a Vue consumer unwraps is a template ref's `Element | ComponentPublicInstance`
([23](23-row-component-contract-is-silent.md)'s `unwrapEl`), not this.

**`MarkedInputProps.Span`** is `ComponentType<SpanProps>`, and `SpanProps` is `MarkProps` with the
`ref` a text token's component has always been handed — the consignment without which the text is
unbound and the caret cannot resolve into it. `RowProps` declares its own for the same reason, so
this is the pair completed rather than a new idea. The widening is source-compatible: a component
written against `MarkProps` still satisfies the prop, because the ref it ignores is optional. The
guide's two Span samples drop their hand-written `MarkProps & {ref?: RefCallback<HTMLElement>}`.

Both pins are in the doc-sample harness and both were seen red. Narrowing `Span` back to
`ComponentType<MarkProps>` reddens `slots-customization.md` with *"TS2339: Property 'ref' does not
exist on type 'MarkProps'"* on the inline-Span fence; naming the wrong element on the overlay
sample reddens `overlay-customization.md` with *"TS2322: Type 'RefObject<HTMLDivElement | null>' is
not assignable to type 'Ref<HTMLUListElement> | undefined'"*.

**Behaviour change:** none at runtime — both are type corrections, and the `ref` a Span receives has
always been passed. The DTS moves: `OverlayHandler` and `useOverlay` gain a type parameter, and
`SpanProps` is a new published type. `StyledMarkProps` in the storybook narrows its own `ref` to the
callback the editor actually hands over, because the wider `Ref` also admits `null`, which no
generated mark can be given.
