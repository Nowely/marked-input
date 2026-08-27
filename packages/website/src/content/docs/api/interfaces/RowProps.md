---
editUrl: false
next: false
prev: false
title: "RowProps"
---

Defined in: [react/markput/src/types.ts:30](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L30)

Props passed to a ROW KIND's component — what `option.row.Component` receives.

A row's structural bytes are not among them: its opener and closing literal are the editor's,
not the document's, so they never reach a component and no caret may enter them.

## Properties

### children?

```ts
optional children: ReactNode;
```

Defined in: [react/markput/src/types.ts:34](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L34)

The row's own inline content, already rendered.

***

### className?

```ts
optional className: string;
```

Defined in: [react/markput/src/types.ts:74](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L74)

***

### depth

```ts
depth: number;
```

Defined in: [react/markput/src/types.ts:49](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L49)

Nesting depth, counted from 0: a ROOT row is at depth 0, its child at depth 1.

***

### index

```ts
index: number;
```

Defined in: [react/markput/src/types.ts:63](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L63)

Position among the row's own SIBLINGS OF EVERY KIND, counted from 0 — `Rows` maps one list
and hands each row where it sits in it. It is the one fact about a row that the row cannot
answer for itself, which is what a kind asking "am I the first of my siblings" needs.

IT IS NOT A LIST ORDINAL. Two paragraphs before a numbered list put its first item at
`index === 2`, so `index + 1` reads "3." — which is why the showcase's own numbered kind
paints an empty span and lets a CSS counter number the run
(`pages/Notion/notion/rows.module.css`).

Kept with no reader in this repo, deliberately: it is published surface with its own
generated page, and zero in-repo callers is not dead code for a published symbol.

***

### meta?

```ts
optional meta: string;
```

Defined in: [react/markput/src/types.ts:32](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L32)

The kind's metadata gap — a todo's checked flag, a fence's language.

***

### node

```ts
node: RowNode;
```

Defined in: [react/markput/src/types.ts:65](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L65)

The live row node: its id, its own text and its verbs.

***

### ref?

```ts
optional ref: RefCallback<HTMLElement>;
```

Defined in: [react/markput/src/types.ts:73](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L73)

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

Defined in: [react/markput/src/types.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L47)

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

Defined in: [react/markput/src/types.ts:75](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L75)
