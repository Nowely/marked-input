---
editUrl: false
next: false
prev: false
title: "MenuSpec"
---

Defined in: [core/src/shared/types.ts:89](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L89)

What an option declares to appear in OverlayController.entries.

## Properties

### keywords?

```ts
optional keywords: readonly string[];
```

Defined in: [core/src/shared/types.ts:93](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L93)

Extra query terms that never appear on screen — `'h1'` for Heading 1.

***

### label

```ts
label: string;
```

Defined in: [core/src/shared/types.ts:91](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L91)

What the row shows, and the only text the typed query is matched against.

***

### meta?

```ts
optional meta: string;
```

Defined in: [core/src/shared/types.ts:100](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L100)

SEEDS for the row this entry writes, and both are DATA rather than a callback: the entry
says what the row starts as, and `choose` is the only thing that writes it. They apply only
where there is nothing to keep — a row that already has text keeps its own body, since a
turn-into must not discard what the user typed.

***

### text?

```ts
optional text: string;
```

Defined in: [core/src/shared/types.ts:101](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L101)
