---
editUrl: false
next: false
prev: false
title: "OverlayList"
---

```ts
function OverlayList(): Element | null;
```

Defined in: [react/markput/src/components/OverlayList/OverlayList.tsx:18](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/components/OverlayList/OverlayList.tsx#L18)

THE OVERLAY LIST, shipped, and the DEFAULT overlay — one component for both lists this adapter
used to ship. `Suggestions` painted `overlay.data` with arrows and Enter; `RowMenu` painted the
options' own `menu` entries with neither, so typing `/h2` and pressing Enter left the literal
text in the row and split it. The rows now come from one model with one keyboard, and the only
difference left between the two lists is where core reads them from.

A consumer wires a row menu with `{overlay: {trigger: '/'}}` and nothing else: no component, no
filtering, no insert logic. `rows` and `choose` are core's, and this is the paint over them.

## Returns

`Element` \| `null`
