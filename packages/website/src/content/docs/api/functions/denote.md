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

Defined in: [core/src/features/parsing/parser/utils/denote.ts:20](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/parser/utils/denote.ts#L20)

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
const result = denote(text, mark => mark.value, ['@[__value__](__meta__)', '#[__slot__]'])
// Returns: 'Hello and nested content'
```
