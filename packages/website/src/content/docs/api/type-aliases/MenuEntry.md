---
editUrl: false
next: false
prev: false
title: "MenuEntry"
---

```ts
type MenuEntry = object;
```

Defined in: [core/src/shared/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L114)

A row-menu entry, as an overlay hands it out: the option that contributed it, plus what to
paint. Insert-versus-turn-into is NOT here and is not anywhere else either — it is a fact
about the caret's row that `choose` reads for itself, so no entry and no overlay member
carries a second copy of it.

`label` DOES mirror `option.menu.label`, on purpose: an entry only exists because its option
declared a menu, so the projection spends the non-null assertion once here rather than making
every painter write `entry.option.menu!.label`.

## Properties

### label

```ts
label: string;
```

Defined in: [core/src/shared/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L114)

***

### option

```ts
option: CoreOption;
```

Defined in: [core/src/shared/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L114)
