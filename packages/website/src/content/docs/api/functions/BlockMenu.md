---
editUrl: false
next: false
prev: false
title: "BlockMenu"
---

```ts
function BlockMenu(): Element | null;
```

Defined in: [react/markput/src/components/BlockMenu/BlockMenu.tsx:17](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/BlockMenu/BlockMenu.tsx#L17)

THE ROW MENU, shipped: one entry per option that declares a `menu`, already narrowed by what
the user typed after the trigger, and a click turns the caret's row into that kind.

A consumer wires it with one line — `{overlay: {trigger: '/'}, Overlay: BlockMenu}` — and a
consumer replacing it writes no filtering and no insert logic either: `entries` and `choose`
are core's, and this component is the paint over them.

`mousedown` is cancelled so the click does not move the caret out of the row the menu is
about before `choose` runs.

## Returns

`Element` \| `null`
