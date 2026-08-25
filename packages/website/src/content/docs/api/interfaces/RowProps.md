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

Defined in: [react/markput/src/types.ts:36](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L36)

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

Defined in: [react/markput/src/types.ts:28](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L28)

The live row node: its id, its own text and its verbs.

***

### ref?

```ts
optional ref: RefCallback<HTMLElement>;
```

Defined in: [react/markput/src/types.ts:35](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L35)

A row kind's component is a SLOT component: spread `ref`, `className` and `style` onto the
element it renders, the way `slots.container` and `slots.block` consumers already do. The
ref is how the editor finds the row's element; a component that drops it leaves the row
unbound, and the caret cannot resolve into it.

***

### style?

```ts
optional style: CSSProperties;
```

Defined in: [react/markput/src/types.ts:37](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L37)
