---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:5

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `T` *extends* `HTMLElement` | `HTMLElement` |

## Properties

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:10

***

### ref

```ts
readonly ref: RefObject<T>;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:6

## Accessors

### content

#### Get Signature

```ts
get content(): string;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:21

Content/label of the mark (displayed text)

##### Returns

`string`

#### Set Signature

```ts
set content(value): void;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:25

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

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:62

Nesting depth of this mark (0 for root-level marks).
Computed lazily on access - O(n) traversal.

##### Returns

`number`

***

### hasChildren

#### Get Signature

```ts
get hasChildren(): boolean;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:69

Whether this mark has nested children

##### Returns

`boolean`

***

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:45

Meta value of the mark

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set meta(value): void;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:49

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

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:77

Parent mark token (undefined for root-level marks).
Computed lazily on access - O(n) traversal.

##### Returns

[`MarkToken`](/api/interfaces/marktoken/) \| `undefined`

***

### tokens

#### Get Signature

```ts
get tokens(): Token[];
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:84

Array of child tokens (read-only)

##### Returns

[`Token`](/api/type-aliases/token/)[]

***

### value

#### Get Signature

```ts
get value(): string | undefined;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:33

Value of the mark (hidden data)

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set value(value): void;
```

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:37

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

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:91

Change mark content, value, and/or meta at once.

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

Defined in: packages/markput/src/lib/classes/MarkHandler.ts:103

Remove this mark.

#### Returns

`void`
