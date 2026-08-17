---
editUrl: false
next: false
prev: false
title: "MarkPatch"
---

```ts
type MarkPatch = object;
```

Defined in: [core/src/features/tokens/tree/types.ts:107](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L107)

The mark patch. Three states per optional field, expressed without a discriminator:
absent/`undefined` leaves the field alone, `null` clears it, a string sets it.

## Properties

### meta?

```ts
readonly optional meta: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:109](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L109)

***

### slot?

```ts
readonly optional slot: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L110)

***

### value?

```ts
readonly optional value: string;
```

Defined in: [core/src/features/tokens/tree/types.ts:108](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L108)
