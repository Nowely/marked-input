---
editUrl: false
next: false
prev: false
title: "MenuSpec"
---

Defined in: [core/src/shared/types.ts:95](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L95)

What an option declares to appear in OverlayListModel.rows.

## Properties

### keywords?

```ts
optional keywords: readonly string[];
```

Defined in: [core/src/shared/types.ts:105](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L105)

Extra query terms that never appear on screen — `'h1'` for Heading 1.

***

### label

```ts
label: string;
```

Defined in: [core/src/shared/types.ts:103](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L103)

What the row shows, and what the typed query is RANKED against: an exact match first, then a
label the query is a prefix of, then a label holding it anywhere — and only then the same
three over [keywords](/api/interfaces/menuspec/#keywords), because a term the user cannot see must not outrank one they are
reading. Declaration order decides inside a band, and decides everything before the first
character is typed.

***

### meta?

```ts
optional meta: string;
```

Defined in: [core/src/shared/types.ts:112](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L112)

SEEDS for the row this entry writes, and both are DATA rather than a callback: the entry
says what the row starts as, and `choose` is the only thing that writes it. They apply only
where there is nothing to keep — a row that already has text keeps its own body, since a
turn-into must not discard what the user typed.

***

### text?

```ts
optional text: string;
```

Defined in: [core/src/shared/types.ts:113](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L113)
