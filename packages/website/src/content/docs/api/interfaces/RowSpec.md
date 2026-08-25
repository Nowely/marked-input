---
editUrl: false
next: false
prev: false
title: "RowSpec"
---

Defined in: [core/src/shared/types.ts:83](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L83)

A row KIND's declaration: what an option adds to make its markup a row rather than a mark.

## Properties

### Component

```ts
Component: ElementType;
```

Defined in: [core/src/shared/types.ts:88](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L88)

REQUIRED. Every row kind renders through its own component; `slots.block` is the PARAGRAPH
component — the row with no kind — and the only fallback left.

***

### continues?

```ts
optional continues: boolean;
```

Defined in: [core/src/shared/types.ts:98](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L98)

Does this kind CONTINUE into the row a split produces: splitting a row of this kind gives the
tail the same kind AND the same `meta`, where by default the tail is a plain row. A list item
continues, a heading does not; a checked to-do splits into two checked to-dos.

ONE field for the whole rule, and it is the same one Enter at a row's end will read: "another
row of this kind" and "the tail keeps this kind" are the same question asked at two caret
positions.
