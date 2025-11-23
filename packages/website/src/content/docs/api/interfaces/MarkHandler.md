---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: [markput/src/utils/hooks/useMark.ts:13](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L13)

## Extends

- `MarkStruct`

## Type Parameters

### T

`T`

## Properties

### change()

> **change**: (`props`, `options?`) => `void`

Defined in: [markput/src/utils/hooks/useMark.ts:23](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L23)

Change mark.

#### Parameters

##### props

`MarkStruct`

##### options?

The options object

###### silent

`boolean`

If true, doesn't change itself label and value, only pass change event.

#### Returns

`void`

***

### children

> **children**: [`Token`](/api/type-aliases/token/)[]

Defined in: [markput/src/utils/hooks/useMark.ts:51](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L51)

Array of child tokens (read-only)

***

### depth

> **depth**: `number`

Defined in: [markput/src/utils/hooks/useMark.ts:39](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L39)

Nesting depth of this mark (0 for root-level marks)

***

### hasChildren

> **hasChildren**: `boolean`

Defined in: [markput/src/utils/hooks/useMark.ts:43](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L43)

Whether this mark has nested children

***

### label

> **label**: `string`

Defined in: [markput/src/utils/hooks/useMark.ts:9](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L9)

#### Inherited from

`MarkStruct.label`

***

### meta?

> `optional` **meta**: `string`

Defined in: [markput/src/utils/hooks/useMark.ts:35](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L35)

Meta value of the mark

***

### parent?

> `optional` **parent**: [`MarkToken`](/api/interfaces/marktoken/)

Defined in: [markput/src/utils/hooks/useMark.ts:47](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L47)

Parent mark token (undefined for root-level marks)

***

### readOnly?

> `optional` **readOnly**: `boolean`

Defined in: [markput/src/utils/hooks/useMark.ts:31](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L31)

Passed the readOnly prop value

***

### ref

> **ref**: `RefObject`\<`T`\>

Defined in: [markput/src/utils/hooks/useMark.ts:17](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L17)

MarkStruct ref. Used for focusing and key handling operations.

***

### remove()

> **remove**: () => `void`

Defined in: [markput/src/utils/hooks/useMark.ts:27](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L27)

Remove itself.

#### Returns

`void`

***

### value?

> `optional` **value**: `string`

Defined in: [markput/src/utils/hooks/useMark.ts:10](https://github.com/Nowely/marked-input/blob/e56ea7644eec9f0085392a774d1029c257015999/packages/markput/src/utils/hooks/useMark.ts#L10)

#### Inherited from

`MarkStruct.value`
