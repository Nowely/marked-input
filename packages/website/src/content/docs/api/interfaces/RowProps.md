---
editUrl: false
next: false
prev: false
title: "RowProps"
---

Defined in: [react/markput/src/types.ts:22](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L22)

Props passed to a ROW KIND's component — what `option.row.Component` receives.

A row's structural bytes are not among them: its opener and closing literal are the editor's,
not the document's, so they never reach a component and no caret may enter them.

## Properties

### children?

```ts
optional children: ReactNode;
```

Defined in: [react/markput/src/types.ts:26](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L26)

The row's own inline content, already rendered.

***

### className?

```ts
optional className: string;
```

Defined in: [react/markput/src/types.ts:53](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L53)

***

### depth

```ts
depth: number;
```

Defined in: [react/markput/src/types.ts:41](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L41)

Nesting depth, counted from the roots.

***

### index

```ts
index: number;
```

Defined in: [react/markput/src/types.ts:43](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L43)

Position among the row's own SIBLINGS — a group wrapper does not renumber the list.

***

### meta?

```ts
optional meta: string;
```

Defined in: [react/markput/src/types.ts:24](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L24)

The kind's metadata gap — a todo's checked flag, a fence's language.

***

### node

```ts
node: RowNode;
```

Defined in: [react/markput/src/types.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L45)

The live row node: its id, its own text and its verbs.

***

### ref?

```ts
optional ref: RefCallback<HTMLElement>;
```

Defined in: [react/markput/src/types.ts:52](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L52)

A row kind's component is a SLOT component: spread `ref`, `className` and `style` onto the
element it renders, the way `slots.container` and `slots.block` consumers already do. The
ref is how the editor finds the row's element; a component that drops it leaves the row
unbound, and the caret cannot resolve into it.

***

### rows?

```ts
optional rows: ReactNode;
```

Defined in: [react/markput/src/types.ts:39](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L39)

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

Defined in: [react/markput/src/types.ts:54](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L54)
