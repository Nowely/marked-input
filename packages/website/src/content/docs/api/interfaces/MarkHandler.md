---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:38](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L38)

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `T` *extends* `HTMLElement` | `HTMLElement` |

## Properties

### readOnly?

```ts
optional readOnly: boolean;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:43](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L43)

***

### ref

```ts
readonly ref: RefObject<T>;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:39](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L39)

## Accessors

### content

#### Get Signature

```ts
get content(): string;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:54](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L54)

Content/label of the mark (displayed text)

##### Returns

`string`

#### Set Signature

```ts
set content(value): void;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:58](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L58)

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

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:95](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L95)

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

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:102](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L102)

Whether this mark has nested children

##### Returns

`boolean`

***

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:78](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L78)

Meta value of the mark

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set meta(value): void;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:82](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L82)

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

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:110](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L110)

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

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:117](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L117)

Array of child tokens (read-only)

##### Returns

[`Token`](/api/type-aliases/token/)[]

***

### value

#### Get Signature

```ts
get value(): string | undefined;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:66](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L66)

Value of the mark (hidden data)

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set value(value): void;
```

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:70](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L70)

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

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:124](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L124)

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

Defined in: [packages/markput/src/utils/hooks/useMark.tsx:136](https://github.com/Nowely/marked-input/blob/next/packages/markput/src/utils/hooks/useMark.tsx#L136)

Remove this mark.

#### Returns

`void`
