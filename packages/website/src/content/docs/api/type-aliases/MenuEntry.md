---
editUrl: false
next: false
prev: false
title: "MenuEntry"
---

```ts
type MenuEntry = object;
```

Defined in: [core/src/shared/types.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L110)

A row-menu entry, as an overlay hands it out: the option that contributed it, plus what to
paint. Insert-versus-turn-into is NOT here and is not anywhere else either — it is a fact
about the caret's row that `choose` reads for itself, so no entry and no overlay member
carries a second copy of it.

## Properties

### label

```ts
label: string;
```

Defined in: [core/src/shared/types.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L110)

***

### option

```ts
option: CoreOption;
```

Defined in: [core/src/shared/types.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L110)
