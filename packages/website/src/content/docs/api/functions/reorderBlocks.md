---
editUrl: false
next: false
prev: false
title: "reorderBlocks"
---

```ts
function reorderBlocks(
   value, 
   blocks, 
   sourceIndex, 
   targetIndex): string;
```

Defined in: common/core/src/features/blocks/reorderBlocks.ts:13

Reorders blocks in the raw string value by moving a source block
to a target position.

## Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `value` | `string` | The full raw string value |
| `blocks` | [`Block`](/api/interfaces/block/)[] | Current block list from splitTokensIntoBlocks |
| `sourceIndex` | `number` | Index of the block being dragged |
| `targetIndex` | `number` | Index where the block should be inserted (before this block) |

## Returns

`string`

The new string value with the block moved
