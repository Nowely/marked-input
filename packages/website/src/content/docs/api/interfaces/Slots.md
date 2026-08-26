---
editUrl: false
next: false
prev: false
title: "Slots"
---

Defined in: [react/markput/src/types.ts:113](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L113)

Available slots for customizing MarkedInput internal components

## Extends

- `CoreSlots`

## Properties

### container?

```ts
optional container: ElementType<Record<string, unknown>>;
```

Defined in: [react/markput/src/types.ts:115](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L115)

Root container component

#### Overrides

```ts
CoreSlots.container
```

***

### paragraph?

```ts
optional paragraph: string | ComponentClass<any, any> | FunctionComponent<any>;
```

Defined in: [core/src/shared/types.ts:251](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L251)

The component a row with NO kind renders through. A kind brings its own, so this is never asked for one.

#### Inherited from

```ts
CoreSlots.paragraph
```
