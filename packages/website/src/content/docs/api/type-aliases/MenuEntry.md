---
editUrl: false
next: false
prev: false
title: "MenuEntry"
---

```ts
type MenuEntry = object;
```

Defined in: [core/src/shared/types.ts:111](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L111)

A row-menu entry, as an overlay hands it out: the option that contributed it, plus what to
paint. `mode` is NOT here — insert-versus-turn-into is a fact about the CARET'S ROW, one per
open overlay rather than one per entry, so it lives on OverlayController.mode.

## Properties

### label

```ts
label: string;
```

Defined in: [core/src/shared/types.ts:111](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L111)

***

### option

```ts
option: CoreOption;
```

Defined in: [core/src/shared/types.ts:111](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L111)

***

### section?

```ts
optional section: string;
```

Defined in: [core/src/shared/types.ts:111](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L111)
