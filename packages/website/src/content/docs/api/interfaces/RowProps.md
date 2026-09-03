---
editUrl: false
next: false
prev: false
title: "RowProps"
---

Defined in: [react/markput/src/types.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L44)

Props passed to a ROW KIND's component — what `option.row.Component` receives.

A row's structural bytes are not among them: its opener and closing literal are the editor's,
not the document's, so they never reach a component and no caret may enter them.

## Properties

### children?

```ts
optional children: ReactNode;
```

Defined in: [react/markput/src/types.ts:48](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L48)

The row's own inline content, already rendered.

***

### className?

```ts
optional className: string;
```

Defined in: [react/markput/src/types.ts:83](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L83)

***

### depth

```ts
depth: number;
```

Defined in: [react/markput/src/types.ts:72](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L72)

Nesting depth, counted from 0: a ROOT row is at depth 0, its child at depth 1.

THERE IS NO SIBLING POSITION BESIDE IT, and its absence is the contract. A position changes
for every row after an insert, so handing one down made a single Enter repaint the whole tail
of the document — half of the whole cost at 4000 rows (ADR-0013). Number a run with a CSS
counter, which is exact and free; `pages/Notion/notion/rows.module.css` is the worked example,
and it was already doing that when the prop still existed, because a position among siblings
of EVERY kind is not a list ordinal.

***

### meta?

```ts
optional meta: string;
```

Defined in: [react/markput/src/types.ts:46](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L46)

The kind's metadata gap — a todo's checked flag, a fence's language.

***

### node

```ts
node: RowNode;
```

Defined in: [react/markput/src/types.ts:74](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L74)

The live row node: its id, its own text and its verbs.

***

### ref?

```ts
optional ref: RefCallback<HTMLElement>;
```

Defined in: [react/markput/src/types.ts:82](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L82)

A row kind's component is a SLOT component: spread `ref`, `className` and `style` onto the
element it renders, the way `slots.container` and `slots.paragraph` consumers already do. The
ref is how the editor finds the row's element; a component that drops it leaves the row
unbound, and the caret cannot resolve into it. That one is REPORTED — nothing on screen says
it otherwise; the other two cost a row that looks wrong rather than one the editor cannot use.

***

### rows?

```ts
optional rows: ReactNode;
```

Defined in: [react/markput/src/types.ts:61](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L61)

The row's CHILD ROWS, already rendered; `undefined` when there are none. A kind that renders
them decides where they go — a toggle hides them, a bullet nests a list inside its `<li>`.

A kind that renders NEITHER them nor a wrapper for them keeps the rows in the value and off
the screen: they round-trip and reappear when the row is outdented. That is Notion's own
behaviour for a heading, and it is what declaring no "can this nest" flag costs.

A collapsed row is HIDDEN, never unmounted: an unpainted row leaves `bind` and takes its
anchors with it, so `End`, select-all and every arrow that resolves through the last row
would walk into a row with no element.

***

### style?

```ts
optional style: CSSProperties;
```

Defined in: [react/markput/src/types.ts:84](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L84)
