# Consumer API v2

The option and props surface a consumer configures. Gathered from seven maintainer notes on
2026-08-15 and checked against the tree; the notes are kept together because they all reshape
the same type, and taking them one at a time would mean several breaking releases instead of
one.

Not a rewrite. One defect runs under most of them; the rest are decisions.

## The defect underneath

An option's `mark` and `overlay` fields are simultaneously configuration and the literal prop
bag handed to the consumer's component.

- `resolveMarkSlot` builds `baseProps = {value, meta}` and passes it to `resolveOptionSlot`
  (`slots/resolveSlot.ts:72-73`), where a **static object replaces the base** and only the
  function form ever receives it (`resolveSlot.ts:5-10`). The one in-repo consumer that wants
  both spreads it by hand: `props => ({...props, style})` (`Nested/MarkdownOptions.ts:117`).
- `option.overlay` is both the trigger config the probe reads (`OverlayController.ts:148`) and
  the props object spread onto the overlay component (`resolveSlot.ts:53`). The conflation
  already has a shipped guard — `Overlay.spec.ts:111` asserts `trigger` and `data` must not
  reach the DOM, and Vue sets `inheritAttrs: false` for the same reason.
- The naming carries the collision too: `Mark`/`mark` and `Overlay`/`overlay` differ only by
  case.

## Facts to design against

All verified against the tree, 2026-08-15.

- `MarkProps.children` is declared but the resolver never supplies it. Children do reach the
  component — as framework children (`Token.tsx:57`, `Token.vue:64`), not as a resolved prop.
- The published JSDoc example on `Option` shows a `slot` field that exists on no type
  (`react/types.ts:39`, mirrored into `api/interfaces/Option.md:15`).
- Global-default-with-per-option-override already exists for the overlay *component*
  (`option.Overlay ?? global ?? Suggestions`, `resolveSlot.ts:48`). It does not exist for
  `showOverlayOn`, which is global-only with a `'change'` default (`PropsModel.ts:38`) while
  being read per probe.
- A markup-less option is already legal and half-works: the overlay opens, then `choose()` bails
  because there is no markup (`OverlayController.ts:111-112`), and no parser is built for it
  (`TokenModel.ts:418`).
- **Option order is load-bearing.** `resolveMarkSlot` indexes options by
  `node.descriptor.index` (`resolveSlot.ts:72`), and the registry preserves original indices for
  undefined markups (`MarkupRegistry.ts:21-26`).
- `Option`, `MarkProps`, `OverlayProps`, `Slots` and `SlotProps` are published from both
  adapters, and `Store` from `@markput/core` (`core/index.ts:4`). Every item here is a contract
  change.

## Decisions

Each is an issue under `issues/`:

1. Split configuration from props — `01`
2. Global defaults with per-option override — `02`
3. Whether a trigger registry (`overlays={[…]}`) exists at all — `03`
4. The hook shapes: `useOverlay`, `useMark`, `useMarkInfo` — `04`
5. One store hook: the `useMarkput` token overload, and deleting Vue's `useStore` — `05`

## Non-goals

- Re-adding a consumer-free overlay getter to `MarkputApi`. It was dropped deliberately.
- Adapter deduplication. Closed — the suggestion keyboard semantics genuinely differ.
