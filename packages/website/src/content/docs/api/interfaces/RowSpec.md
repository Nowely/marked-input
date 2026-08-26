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
optional continues: boolean | CoreOption;
```

Defined in: [core/src/shared/types.ts:161](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L161)

WHAT THE ROW A SPLIT PRODUCES IS. `true` is this kind again, AND the same `meta` — a list item
continues, a checked to-do splits into two checked to-dos. `false` or absent is a plain row,
which is what a heading wants.

AN OPTION IS A THIRD ANSWER: the tail takes THAT kind, carrying no `meta` of this one's. A
table HEADER is the shape that needs it — it continues into a table LINE, not into a second
header and not into a paragraph, and without it the obvious way to add the first data row
(Enter, then type the cells) left a paragraph holding literal pipes. The option must be one
this editor compiled a row kind from, exactly as [split](/api/interfaces/rowspec/#split)'s `as` must; anything else
continues into a plain row.

ONE field for the whole rule, and it is the same one Enter at a row's end reads: "another row
of this kind" and "the tail keeps this kind" are the same question asked at two caret
positions.

***

### indents?

```ts
optional indents: boolean;
```

Defined in: [core/src/shared/types.ts:171](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L171)

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

Defined in: [core/src/shared/types.ts:186](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L186)

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
