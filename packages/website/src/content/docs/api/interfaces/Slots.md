---
editUrl: false
next: false
prev: false
title: "Slots"
---

Defined in: [react/markput/src/types.ts:105](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L105)

Available slots for customizing MarkedInput internal components

## Extends

- `CoreSlots`

## Properties

### container?

```ts
optional container: ElementType<Record<string, unknown>>;
```

Defined in: [react/markput/src/types.ts:107](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L107)

Root container component

#### Overrides

```ts
CoreSlots.container
```

***

### paragraph?

```ts
optional paragraph: ElementType;
```

Defined in: [core/src/shared/types.ts:221](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L221)

The component a row with NO kind renders through. A kind brings its own, so this is never asked for one.

#### Inherited from

```ts
CoreSlots.paragraph
```
