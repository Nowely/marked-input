---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: [markput/src/lib/classes/MarkHandler.ts:6](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L6)

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `T` *extends* `HTMLElement` | `HTMLElement` |

## Properties

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:10](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L10)

***

### ref

```ts
readonly ref: RefObject<T>;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L7)

## Accessors

### content

#### Get Signature

```ts
get content(): string;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:21](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L21)

Displayed text of the mark

##### Returns

`string`

#### Set Signature

```ts
set content(value): void;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:25](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L25)

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `string` |

##### Returns

`void`

***

### depth

#### Get Signature

```ts
get depth(): number;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:53](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L53)

Nesting depth (0 for root-level marks)

##### Returns

`number`

***

### hasChildren

#### Get Signature

```ts
get hasChildren(): boolean;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:58](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L58)

Whether this mark has nested children

##### Returns

`boolean`

***

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:41](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L41)

Optional metadata for the mark

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set meta(value): void;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L45)

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `string` \| `undefined` |

##### Returns

`void`

***

### parent

#### Get Signature

```ts
get parent(): MarkToken | undefined;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:63](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L63)

Parent mark token (undefined for root-level marks)

##### Returns

[`MarkToken`](/api/interfaces/marktoken/) \| `undefined`

***

### tokens

#### Get Signature

```ts
get tokens(): Token[];
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:68](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L68)

Child tokens of this mark

##### Returns

[`Token`](/api/type-aliases/token/)[]

***

### value

#### Get Signature

```ts
get value(): string | undefined;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:31](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L31)

Data value associated with the mark

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set value(value): void;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:35](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L35)

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `string` \| `undefined` |

##### Returns

`void`

## Methods

### change()

```ts
change(props): void;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:75](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L75)

Update multiple properties in a single operation

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `props` | \{ `content`: `string`; `meta?`: `string`; `value?`: `string`; \} |
| `props.content` | `string` |
| `props.meta?` | `string` |
| `props.value?` | `string` |

#### Returns

`void`

***

### remove()

```ts
remove(): void;
```

Defined in: [markput/src/lib/classes/MarkHandler.ts:85](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/lib/classes/MarkHandler.ts#L85)

Delete this mark from the editor

#### Returns

`void`
