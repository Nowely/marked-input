---
editUrl: false
next: false
prev: false
title: "Option"
---

Defined in: [packages/markput/src/types.ts:51](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L51)

React-specific markup option for defining mark behavior and styling.

## Example

```ts
const option: Option = {
  markup: '@[__value__]',
  mark: { slot: Button, label: 'Click' }
}
```

## Extends

- `CoreOption`

## Properties

### mark?

```ts
optional mark: 
  | MarkProps
  | (props) => MarkProps;
```

Defined in: [packages/markput/src/types.ts:56](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L56)

Props for the mark component.
Can be a static object or a function that transforms MarkProps.

***

### markup?

```ts
optional markup: Markup;
```

Defined in: [packages/core/src/shared/types.ts:35](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L35)

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
optional overlay: OverlayProps;
```

Defined in: [packages/markput/src/types.ts:60](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/types.ts#L60)

Props for the overlay component.
