---
editUrl: false
next: false
prev: false
title: "Option"
---

Defined in: [react/markput/src/types.ts:48](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L48)

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
| `TOverlayProps` | [`OverlayProps`](/api/interfaces/overlayprops/) | Type of props for the overlay component |

## Properties

### mark?

```ts
optional mark: TMarkProps | (props) => TMarkProps;
```

Defined in: [react/markput/src/types.ts:53](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L53)

Props for the mark component.
Can be a static object or a function that transforms MarkProps.

***

### markup?

```ts
optional markup: Markup;
```

Defined in: [common/core/src/shared/types.ts:36](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/shared/types.ts#L36)

Template string in which the mark is rendered.
Must contain placeholders: `__value__`, `__meta__`, and/or `__nested__`

Placeholder types:
- `__value__` - main content (plain text, no nesting)
- `__meta__` - additional metadata (plain text, no nesting)
- `__nested__` - content supporting nested structures

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
"@[__nested__]"
```

#### Inherited from

```ts
CoreOption.markup
```

***

### overlay?

```ts
optional overlay: TOverlayProps;
```

Defined in: [react/markput/src/types.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L57)

Props for the overlay component.
