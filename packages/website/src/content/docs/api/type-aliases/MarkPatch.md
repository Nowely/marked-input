---
editUrl: false
next: false
prev: false
title: "MarkPatch"
---

```ts
type MarkPatch = object;
```

Defined in: [core/src/features/tokens/tree/types.ts:65](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L65)

The mark patch. Three states per optional field, expressed without a discriminator:
absent/`undefined` leaves the field alone, `null` clears it, a string sets it.

## Properties

### meta?

```ts
readonly optional meta: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:67](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L67)

***

### slot?

```ts
readonly optional slot: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:68](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L68)

***

### value?

```ts
readonly optional value: string;
```

Defined in: [core/src/features/tokens/tree/types.ts:66](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L66)
