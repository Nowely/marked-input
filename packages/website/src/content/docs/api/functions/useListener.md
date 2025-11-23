---
editUrl: false
next: false
prev: false
title: "useListener"
---

## Call Signature

> **useListener**\<`T`\>(`key`, `listener`, `deps?`): `void`

Defined in: [markput/src/utils/hooks/useListener.tsx:7](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useListener.tsx#L7)

### Type Parameters

#### T

`T`

### Parameters

#### key

`EventKey`\<`T`\>

#### listener

`Listener`\<`T`\>

#### deps?

`DependencyList`

### Returns

`void`

## Call Signature

> **useListener**\<`K`\>(`key`, `listener`, `deps?`): `void`

Defined in: [markput/src/utils/hooks/useListener.tsx:8](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useListener.tsx#L8)

### Type Parameters

#### K

`K` *extends* keyof `HTMLElementEventMap`

### Parameters

#### key

`K`

#### listener

`Listener`\<`HTMLElementEventMap`\[`K`\]\>

#### deps?

`DependencyList`

### Returns

`void`
