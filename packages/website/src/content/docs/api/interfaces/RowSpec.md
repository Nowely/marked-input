---
editUrl: false
next: false
prev: false
title: "RowSpec"
---

Defined in: [core/src/shared/types.ts:156](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L156)

A row KIND's declaration: what an option adds to make its markup a row rather than a mark.

## Properties

### Component

```ts
Component: ElementType;
```

Defined in: [core/src/shared/types.ts:161](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L161)

REQUIRED. Every row kind renders through its own component; `slots.paragraph` is the row
with no kind, and the only fallback left.

***

### continues?

```ts
optional continues: boolean | CoreOption;
```

Defined in: [core/src/shared/types.ts:183](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L183)

WHAT THE ROW A SPLIT PRODUCES IS. `true` is this kind again — a list item continues. `false`
or absent is a plain row, which is what a heading wants.

THE KIND CONTINUES AND THE ROW'S OWN `meta` DOES NOT. A meta is the ROW's field, not the
kind's: `- [x] ` says THIS task is done, and Enter after it used to open a second task already
ticked. What the tail carries instead is the kind's SEED, `menu.meta` — what a row of this
kind starts as through every other door — so "a new to-do" means the same thing whether the
menu or Enter opened it. A kind whose meta really belongs to the kind says so by seeding it.

AN OPTION IS A THIRD ANSWER: the tail takes THAT kind, and that kind's seed. A table HEADER is
the shape that needs it — it continues into a table LINE, not into a second header and not
into a paragraph, and without it the obvious way to add the first data row (Enter, then type
the cells) left a paragraph holding literal pipes. The option must be one this editor compiled
a row kind from, exactly as [split](/api/interfaces/rowspec/#split)'s `as` must; anything else continues into a plain
row.

ONE field for the whole rule, and it is the same one Enter at a row's end reads: "another row
of this kind" and "the tail keeps this kind" are the same question asked at two caret
positions.

***

### indents?

```ts
optional indents: boolean;
```

Defined in: [core/src/shared/types.ts:197](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L197)

DOES TAB BELONG TO THIS EDITOR. Default false, so an editor no option declares it on leaves
Tab to the browser and the field stays escapable by keyboard alone — ADR-0002's accepted
cost, preserved rather than traded for a keyboard trap.

ONE OPTION DECLARING IT ANSWERS FOR THE WHOLE EDITOR, and that is the granularity the
question has: it gates the KEY, and the key belongs to the field. Whether a PARTICULAR row
may go one level deeper is a structural question with an owner of its own — the scan's depth
ceiling plus "does the would-be parent paint child rows" — which is also what a DROP asks. So
Tab re-indents a row of any kind wherever a drag onto the same gap would, and it is consumed
even where the verb then refuses the step: a Tab that sometimes moves focus and sometimes
indents is worse than either.

***

### split?

```ts
optional split: object;
```

Defined in: [core/src/shared/types.ts:212](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L212)

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
