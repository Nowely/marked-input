---
editUrl: false
next: false
prev: false
title: "RowPlacement"
---

```ts
type RowPlacement = object;
```

Defined in: [core/src/features/tokens/tree/types.ts:192](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L192)

WHERE a row goes: the row it becomes a child of (`null` for the document's own root list) and
the index it takes among that parent's child rows AFTER the move, counted with the moved row
itself taken out. So `parent.rows()[index] === row` is the postcondition, and `index ===
rows().length` appends.

A parent NODE rather than a depth, because depth alone cannot say which of two same-depth
parents a row joins, and the tree carries no parent pointers to disambiguate it afterwards.

## Properties

### index

```ts
index: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:192](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L192)

***

### parent

```ts
parent: RowNode | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:192](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L192)
