---
editUrl: false
next: false
prev: false
title: "Option"
---

Defined in: [react/markput/src/types.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L110)

React-specific markup option for defining mark behavior and styling.

## Example

```ts
const option: Option<ChipProps> = {
  markup: '@[__value__]',
  mark: { slot: Chip, label: 'Click' }
}
```

## Extends

- `CoreOption`

## Type Parameters

| Type Parameter | Default type | Description |
| ------ | ------ | ------ |
| `TMarkProps` | [`MarkProps`](/api/interfaces/markprops/) | Type of props for the mark component |
| `TOverlayProps` *extends* `CoreOption`\[`"overlay"`\] | [`OverlayProps`](/api/interfaces/overlayprops/) | Type of props for the overlay component |

## Properties

### mark?

```ts
optional mark: TMarkProps | (props) => TMarkProps;
```

Defined in: [react/markput/src/types.ts:120](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L120)

Props for the mark component.
Can be a static object or a function that transforms MarkProps.

***

### Mark?

```ts
optional Mark: ComponentType<TMarkProps>;
```

Defined in: [react/markput/src/types.ts:115](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L115)

Per-option component for rendering this mark

***

### markup?

```ts
optional markup: Markup;
```

Defined in: [core/src/shared/types.ts:63](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L63)

Template string in which the mark is rendered.
Must contain placeholders: `__value__`, `__meta__`, and/or `__slot__`

Placeholder types:
- `__value__` - main content (plain text, no nesting)
- `__meta__` - additional metadata (plain text, no nesting)
- `__slot__` - content supporting nested structures

A markup that breaks those rules — no placeholder at all, too many of one kind, or a
LEADING placeholder — is reported to the console and contributes nothing: the option is
skipped and every other option keeps its index. Omitting `markup` does the same, quietly.

"Contributes nothing" reaches the overlay too. An `overlay.trigger` on such an option still
OPENS the overlay — that is how an overlay-only option is written — but choosing a
suggestion inserts nothing rather than writing a markup no parser can read back.

#### Examples

```ts
// Simple value
"@[__value__]"
```

```ts
// Value with metadata
"@[__value__](__meta__)"
```

```ts
// Nested content support
"@[__slot__]"
```

#### Inherited from

```ts
CoreOption.markup
```

***

### menu?

```ts
optional menu: MenuSpec;
```

Defined in: [core/src/shared/types.ts:91](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L91)

ONE contribution to the row menu an overlay offers, and its PRESENCE is what puts the option
there — an option that declares a menu entry IS the menu, so no list of kinds is written
anywhere else and no consumer component filters one.

WITH NO [markup](/api/interfaces/option/#markup) IT IS THE UN-TYPING ENTRY: choosing it turns the caret's row back into
the row with NO kind, which renders through `slots.paragraph`. That is the one kind no option
can declare, so it was the one entry a block menu could not carry — and every editor has it.
Core ships no label for it: what it is called, and where it sits in the list, is the
consumer's, exactly like every other entry.

#### Inherited from

```ts
CoreOption.menu
```

***

### overlay?

```ts
optional overlay: TOverlayProps;
```

Defined in: [react/markput/src/types.ts:126](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L126)

Props for the overlay component.

#### Overrides

```ts
CoreOption.overlay
```

***

### Overlay?

```ts
optional Overlay: ComponentType<TOverlayProps>;
```

Defined in: [react/markput/src/types.ts:122](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L122)

Per-option component for rendering this overlay

***

### row?

```ts
optional row: RowSpec;
```

Defined in: [core/src/shared/types.ts:74](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L74)

Presence makes this a ROW option: its `markup` is matched ONLY at a row's own start, never
anywhere inside a line, and matching it TYPES the row — the row renders through this
option's own component instead of the paragraph slot.

A row markup obeys the mark rules plus three of its own: exactly one body placeholder
(`__slot__` for an inline-parsed body, `__value__` for a raw one), no second `__value__`,
and no two placeholders touching. A markup that breaks one, or that compiles to an opener
an earlier row option already claims, is reported and contributes no row kind.

#### Inherited from

```ts
CoreOption.row
```
