---
editUrl: false
next: false
prev: false
title: "MarkPatch"
---

```ts
type MarkPatch = object;
```

Defined in: [core/src/features/tokens/tree/types.ts:72](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L72)

The mark patch. Three states per optional field, expressed without a discriminator:
absent/`undefined` leaves the field alone, `null` clears it, a string sets it.

## Properties

### meta?

```ts
readonly optional meta: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:74](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L74)

***

### slot?

```ts
readonly optional slot: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:75](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L75)

***

### value?

```ts
readonly optional value: string;
```

Defined in: [core/src/features/tokens/tree/types.ts:73](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L73)
