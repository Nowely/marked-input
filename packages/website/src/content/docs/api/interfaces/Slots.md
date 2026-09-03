---
editUrl: false
next: false
prev: false
title: "Slots"
---

Defined in: [react/markput/src/types.ts:132](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L132)

Available slots for customizing MarkedInput internal components

## Extends

- `CoreSlots`

## Properties

### container?

```ts
optional container: ElementType<Record<string, unknown>>;
```

Defined in: [react/markput/src/types.ts:134](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/types.ts#L134)

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

Defined in: [core/src/shared/types.ts:261](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/types.ts#L261)

The component a row with NO kind renders through. A kind brings its own, so this is never asked for one.

#### Inherited from

```ts
CoreSlots.paragraph
```
