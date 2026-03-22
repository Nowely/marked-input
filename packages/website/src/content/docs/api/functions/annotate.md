---
editUrl: false
next: false
prev: false
title: "annotate"
---

```ts
function annotate(markup, params): string;
```

Defined in: [common/core/src/features/parsing/parser/utils/annotate.ts:18](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/parsing/parser/utils/annotate.ts#L18)

Make annotation from the markup for ParserV2

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `markup` | [`Markup`](/api/type-aliases/markup/) | Markup pattern with __value__, __meta__, and/or __nested__ placeholders |
| `params` | \{ `meta?`: `string`; `nested?`: `string`; `value?`: `string`; \} | Object with optional value, meta, and nested strings |
| `params.meta?` | `string` | - |
| `params.nested?` | `string` | - |
| `params.value?` | `string` | - |

## Returns

`string`

Annotated string with placeholders replaced

## Example

```typescript
annotate('@[__value__]', { value: 'Hello' }) // '@[Hello]'
annotate('@[__value__](__meta__)', { value: 'Hello', meta: 'world' }) // '@[Hello](world)'
annotate('@[__nested__]', { nested: 'content' }) // '@[content]'
```
