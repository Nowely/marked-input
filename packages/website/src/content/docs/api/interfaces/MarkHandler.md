---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:5](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L5)

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `T` *extends* `HTMLElement` | `HTMLElement` |

## Properties

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:9](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L9)

***

### ref

```ts
readonly ref: RefObject<T>;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:6](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L6)

## Accessors

### content

#### Get Signature

```ts
get content(): string;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:20](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L20)

Displayed text of the mark

##### Returns

`string`

#### Set Signature

```ts
set content(value): void;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:24](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L24)

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

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:52](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L52)

Nesting depth (0 for root-level marks)

##### Returns

`number`

***

### hasChildren

#### Get Signature

```ts
get hasChildren(): boolean;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L57)

Whether this mark has nested children

##### Returns

`boolean`

***

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L40)

Optional metadata for the mark

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set meta(value): void;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L44)

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

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:62](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L62)

Parent mark token (undefined for root-level marks)

##### Returns

[`MarkToken`](/api/interfaces/marktoken/) \| `undefined`

***

### tokens

#### Get Signature

```ts
get tokens(): Token[];
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:67](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L67)

Child tokens of this mark

##### Returns

[`Token`](/api/type-aliases/token/)[]

***

### value

#### Get Signature

```ts
get value(): string | undefined;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:30](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L30)

Data value associated with the mark

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set value(value): void;
```

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:34](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L34)

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

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:74](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L74)

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

Defined in: [react/markput/src/lib/classes/MarkHandler.ts:84](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/classes/MarkHandler.ts#L84)

Delete this mark from the editor

#### Returns

`void`
