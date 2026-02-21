---
editUrl: false
next: false
prev: false
title: "denote"
---

```ts
function denote(
   value, 
   callback, 
   markups): string;
```

Defined in: [common/core/src/features/parsing/ParserV2/utils/denote.ts:20](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/parsing/ParserV2/utils/denote.ts#L20)

Transform annotated text to another text by recursively processing all tokens

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `value` | `string` | Annotated text to process |
| `callback` | (`mark`) => `string` | Function to transform each MarkToken |
| `markups` | [`Markup`](/api/type-aliases/markup/)[] | Array of markup patterns to parse |

## Returns

`string`

Transformed text

## Example

```typescript
const text = '@[Hello](world) and #[nested @[content]]'
const result = denote(text, mark => mark.value, ['@[__value__](__meta__)', '#[__nested__]'])
// Returns: 'Hello and nested content'
```
