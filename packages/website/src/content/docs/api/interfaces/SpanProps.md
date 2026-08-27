---
editUrl: false
next: false
prev: false
title: "SpanProps"
---

Defined in: [react/markput/src/types.ts:33](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L33)

Props passed to the global `Span` — the component that paints a TEXT token.

IT IS HANDED A `ref` AND A MARK IS NOT, which is the whole of why this is its own type. A mark
is painted inside a wrapper markput owns and that wrapper carries the consignment, so a Mark
component forwards nothing; a text token's element IS the Surface core writes into, so the ref
lands on the consumer's own element. A `Span` that drops it leaves the text unbound and the
caret cannot resolve into it.

## Extends

- [`MarkProps`](/api/interfaces/markprops/)

## Properties

### children?

```ts
optional children: ReactNode;
```

Defined in: [react/markput/src/types.ts:21](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L21)

Rendered children content (ReactNode) for nested marks

#### Inherited from

[`MarkProps`](/api/interfaces/markprops/).[`children`](/api/interfaces/markprops/#children)

***

### meta?

```ts
optional meta: string;
```

Defined in: [react/markput/src/types.ts:19](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L19)

Additional metadata for the mark

#### Inherited from

[`MarkProps`](/api/interfaces/markprops/).[`meta`](/api/interfaces/markprops/#meta)

***

### ref?

```ts
optional ref: RefCallback<HTMLElement>;
```

Defined in: [react/markput/src/types.ts:35](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L35)

Spread onto the element the component renders — see [RowProps.ref](/api/interfaces/rowprops/#ref) for the same rule.

***

### value?

```ts
optional value: string;
```

Defined in: [react/markput/src/types.ts:17](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L17)

Main content value of the mark

#### Inherited from

[`MarkProps`](/api/interfaces/markprops/).[`value`](/api/interfaces/markprops/#value)
