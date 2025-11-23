---
editUrl: false
next: false
prev: false
title: "Option"
---

Defined in: [markput/src/types.ts:48](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/types.ts#L48)

React-specific markup option for defining mark behavior and styling.

## Example

```ts
const option: Option = {
  markup: '@[__value__]',
  slots: { mark: Button },
  slotProps: { mark: { label: 'Click' } }
}
```

## Extends

- `CoreOption`

## Type Parameters

### TMarkProps

`TMarkProps` = [`MarkProps`](/api/interfaces/markprops/)

### TOverlayProps

`TOverlayProps` = [`OverlayProps`](/api/interfaces/overlayprops/)

## Properties

### markup?

> `optional` **markup**: [`Markup`](/api/type-aliases/markup/)

Defined in: [core/src/shared/types.ts:35](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/core/src/shared/types.ts#L35)

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

`CoreOption.markup`

***

### slotProps?

> `optional` **slotProps**: `object`

Defined in: [markput/src/types.ts:61](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/types.ts#L61)

Props for slot components.

#### mark?

> `optional` **mark**: `TMarkProps` \| (`props`) => `TMarkProps`

Props for the mark component.
Can be a static object or a function that transforms MarkProps.

#### overlay?

> `optional` **overlay**: `TOverlayProps`

Props for the overlay component.

***

### slots?

> `optional` **slots**: `object`

Defined in: [markput/src/types.ts:52](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/types.ts#L52)

Per-option slot components.

#### mark?

> `optional` **mark**: `ComponentType`\<`TMarkProps`\>

Mark component for this option.

#### overlay?

> `optional` **overlay**: `ComponentType`\<`TOverlayProps`\>

Overlay component for this option.
