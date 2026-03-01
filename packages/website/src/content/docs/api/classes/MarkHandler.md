---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: [common/core/src/features/mark/MarkHandler.ts:9](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L9)

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `T` *extends* `HTMLElement` | `HTMLElement` |

## Constructors

### Constructor

```ts
new MarkHandler<T>(param): MarkHandler<T>;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:15](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L15)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `param` | \{ `ref`: `RefAccessor`\<`T`\>; `store`: `Store`; `token`: [`MarkToken`](/api/interfaces/marktoken/); \} |
| `param.ref` | `RefAccessor`\<`T`\> |
| `param.store` | `Store` |
| `param.token` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkHandler`\<`T`\>

## Properties

| Property | Modifier | Type | Defined in |
| ------ | ------ | ------ | ------ |
| <a id="property-ref"></a> `ref` | `readonly` | `RefAccessor`\<`T`\> | [common/core/src/features/mark/MarkHandler.ts:10](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L10) |

## Accessors

### content

#### Get Signature

```ts
get content(): string;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:29](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L29)

##### Returns

`string`

#### Set Signature

```ts
set content(value): void;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:33](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L33)

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

Defined in: [common/core/src/features/mark/MarkHandler.ts:56](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L56)

##### Returns

`number`

***

### hasChildren

#### Get Signature

```ts
get hasChildren(): boolean;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:60](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L60)

##### Returns

`boolean`

***

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L47)

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set meta(v): void;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:51](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L51)

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `v` | `string` \| `undefined` |

##### Returns

`void`

***

### parent

#### Get Signature

```ts
get parent(): MarkToken | undefined;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:64](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L64)

##### Returns

[`MarkToken`](/api/interfaces/marktoken/) \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean | undefined;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:21](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L21)

##### Returns

`boolean` \| `undefined`

#### Set Signature

```ts
set readOnly(value): void;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:25](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L25)

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `value` | `boolean` \| `undefined` |

##### Returns

`void`

***

### tokens

#### Get Signature

```ts
get tokens(): Token[];
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:68](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L68)

##### Returns

[`Token`](/api/type-aliases/token/)[]

***

### value

#### Get Signature

```ts
get value(): string | undefined;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:38](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L38)

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set value(v): void;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:42](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L42)

##### Parameters

| Parameter | Type |
| ------ | ------ |
| `v` | `string` \| `undefined` |

##### Returns

`void`

## Methods

### change()

```ts
change(props): void;
```

Defined in: [common/core/src/features/mark/MarkHandler.ts:72](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L72)

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

Defined in: [common/core/src/features/mark/MarkHandler.ts:81](https://github.com/Nowely/marked-input/blob/next/packages/common/core/src/features/mark/MarkHandler.ts#L81)

#### Returns

`void`
