---
editUrl: false
next: false
prev: false
title: "annotate"
---

> **annotate**(`markup`, `params`): `string`

Defined in: [core/src/features/parsing/ParserV2/utils/annotate.ts:18](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/core/src/features/parsing/ParserV2/utils/annotate.ts#L18)

Make annotation from the markup for ParserV2

## Parameters

### markup

[`Markup`](/api/type-aliases/markup/)

Markup pattern with __value__, __meta__, and/or __nested__ placeholders

### params

Object with optional value, meta, and nested strings

#### meta?

`string`

#### nested?

`string`

#### value?

`string`

## Returns

`string`

Annotated string with placeholders replaced

## Example

```typescript
annotate('@[__value__]', { value: 'Hello' }) // '@[Hello]'
annotate('@[__value__](__meta__)', { value: 'Hello', meta: 'world' }) // '@[Hello](world)'
annotate('@[__nested__]', { nested: 'content' }) // '@[content]'
```
