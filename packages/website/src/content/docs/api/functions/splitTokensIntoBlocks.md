---
editUrl: false
next: false
prev: false
title: "splitTokensIntoBlocks"
---

```ts
function splitTokensIntoBlocks(tokens): Block[];
```

Defined in: common/core/src/features/blocks/splitTokensIntoBlocks.ts:17

Groups a flat list of root-level tokens into blocks by splitting on newline boundaries.

Block-level marks (whose markup ends with `\n`) form their own block.
Text tokens containing `\n` are split at newline boundaries — each line
becomes a separate block along with any adjacent marks.

## Parameters

| Parameter | Type |
| ------ | ------ |
| `tokens` | [`Token`](/api/type-aliases/token/)[] |

## Returns

[`Block`](/api/interfaces/block/)[]
