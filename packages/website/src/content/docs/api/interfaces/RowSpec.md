---
editUrl: false
next: false
prev: false
title: "RowSpec"
---

Defined in: [core/src/shared/types.ts:139](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L139)

A row KIND's declaration: what an option adds to make its markup a row rather than a mark.

## Properties

### Component

```ts
Component: ElementType;
```

Defined in: [core/src/shared/types.ts:144](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L144)

REQUIRED. Every row kind renders through its own component; `slots.paragraph` is the row
with no kind, and the only fallback left.

***

### continues?

```ts
optional continues: boolean;
```

Defined in: [core/src/shared/types.ts:154](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L154)

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

Defined in: [core/src/shared/types.ts:164](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L164)

Does Tab / Shift+Tab re-indent a row of this kind, and does Tab belong to the editor at all
while the caret is in one. Default false, so Tab still LEAVES THE FIELD everywhere else —
ADR-0002's accepted cost, preserved rather than traded for a keyboard trap.

It gates the KEY, not the verb: a kind that declares it consumes Tab even where the depth
cannot change, because a Tab that sometimes moves focus and sometimes indents is worse than
either.

***

### split?

```ts
optional split: object;
```

Defined in: [core/src/shared/types.ts:179](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L179)

This kind carves its OWN body at a literal, and each piece becomes an ordinary Row of the
option `as` names — a table line into cells. A cell is not a node kind of its own: it is a Row
whose structural bytes are the delimiter it was carved at, so it renders through its option's
component, holds ordinary inline marks, and round-trips by concatenation.

`as` may be an option with NO markup at all — an anonymous kind, which nothing scans and which
exists only as a split's target. It must be an option of this editor carrying `row`; anything
else is reported and this kind carves nothing.

A carved row takes no indent-nested children: its children ARE its body. Tab inside one walks
to the next piece rather than changing depth, and a piece cannot contain the delimiter — an
escape scoped to a cell's body is the named follow-up.

#### as

```ts
as: CoreOption;
```

#### at

```ts
at: string;
```
