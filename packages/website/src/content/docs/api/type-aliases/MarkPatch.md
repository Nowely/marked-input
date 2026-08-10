---
editUrl: false
next: false
prev: false
title: "MarkPatch"
---

```ts
type MarkPatch = object;
```

Defined in: [core/src/features/tokens/tree/types.ts:68](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L68)

Spec §2.3's mark patch. Three states per optional field, expressed without a
discriminator (plan decision D-b): absent/`undefined` leaves the field alone, `null`
clears it, a string sets it. Replaces the `{kind:'set'|'clear'}` `OptionalMarkFieldPatch`
of the pre-v2 surface — a documented break.

## Properties

### meta?

```ts
readonly optional meta: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:70](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L70)

***

### slot?

```ts
readonly optional slot: string | null;
```

Defined in: [core/src/features/tokens/tree/types.ts:71](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L71)

***

### value?

```ts
readonly optional value: string;
```

Defined in: [core/src/features/tokens/tree/types.ts:69](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L69)
