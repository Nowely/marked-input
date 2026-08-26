---
editUrl: false
next: false
prev: false
title: "RowMenu"
---

```ts
function RowMenu(): Element | null;
```

Defined in: [react/markput/src/components/RowMenu/RowMenu.tsx:14](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/RowMenu/RowMenu.tsx#L14)

THE ROW MENU, shipped: one entry per option that declares a `menu`, already narrowed by what
the user typed after the trigger, and a click turns the caret's row into that kind.

A consumer wires it with one line — `{overlay: {trigger: '/'}, Overlay: RowMenu}` — and a
consumer replacing it writes no filtering and no insert logic either: `entries` and `choose`
are core's, and this component is the paint over them.

## Returns

`Element` \| `null`
