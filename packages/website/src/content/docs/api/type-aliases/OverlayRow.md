---
editUrl: false
next: false
prev: false
title: "OverlayRow"
---

```ts
type OverlayRow = object;
```

Defined in: [core/src/shared/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L114)

ONE ROW of the list an open overlay offers: what to paint, and the pick that choosing it
commits. It is the SAME shape for a suggestion and for a row-menu entry, which is what let the
two lists collapse into OverlayListModel — a painter reads `label`, a click hands
`pick` straight back to `choose`, and neither has to know which source the row came from.

Insert-versus-turn-into is NOT here and is not anywhere else either — it is a fact about the
caret's row that `choose` reads for itself, so no row and no overlay member carries a second
copy of it.

## Properties

### label

```ts
label: string;
```

Defined in: [core/src/shared/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L114)

***

### pick

```ts
pick: OverlayPick;
```

Defined in: [core/src/shared/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L114)
