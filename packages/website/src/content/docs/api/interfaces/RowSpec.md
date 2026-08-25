---
editUrl: false
next: false
prev: false
title: "RowSpec"
---

Defined in: [core/src/shared/types.ts:136](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L136)

A row KIND's declaration: what an option adds to make its markup a row rather than a mark.

## Properties

### Component

```ts
Component: ElementType;
```

Defined in: [core/src/shared/types.ts:141](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L141)

REQUIRED. Every row kind renders through its own component; `slots.block` is the PARAGRAPH
component — the row with no kind — and the only fallback left.

***

### continues?

```ts
optional continues: boolean;
```

Defined in: [core/src/shared/types.ts:151](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L151)

Does this kind CONTINUE into the row a split produces: splitting a row of this kind gives the
tail the same kind AND the same `meta`, where by default the tail is a plain row. A list item
continues, a heading does not; a checked to-do splits into two checked to-dos.

ONE field for the whole rule, and it is the same one Enter at a row's end reads: "another row
of this kind" and "the tail keeps this kind" are the same question asked at two caret
positions.

***

### indents?

```ts
optional indents: boolean;
```

Defined in: [core/src/shared/types.ts:161](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L161)

Does Tab / Shift+Tab re-indent a row of this kind, and does Tab belong to the editor at all
while the caret is in one. Default false, so Tab still LEAVES THE FIELD everywhere else —
ADR-0002's accepted cost, preserved rather than traded for a keyboard trap.

It gates the KEY, not the verb: a kind that declares it consumes Tab even where the depth
cannot change, because a Tab that sometimes moves focus and sometimes indents is worse than
either.
