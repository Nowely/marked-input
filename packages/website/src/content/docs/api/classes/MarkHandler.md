---
editUrl: false
next: false
prev: false
title: "MarkHandler"
---

Defined in: common/core/src/features/mark/MarkHandler.ts:10

## Type Parameters

| Type Parameter | Default type |
| ------ | ------ |
| `T` *extends* `HTMLElement` | `HTMLElement` |

## Constructors

### Constructor

```ts
new MarkHandler<T>(param): MarkHandler<T>;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:16

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
| <a id="property-ref"></a> `ref` | `readonly` | `RefAccessor`\<`T`\> | common/core/src/features/mark/MarkHandler.ts:11 |

## Accessors

### content

#### Get Signature

```ts
get content(): string;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:30

##### Returns

`string`

#### Set Signature

```ts
set content(value): void;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:34

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

Defined in: common/core/src/features/mark/MarkHandler.ts:57

##### Returns

`number`

***

### hasChildren

#### Get Signature

```ts
get hasChildren(): boolean;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:61

##### Returns

`boolean`

***

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:48

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set meta(v): void;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:52

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

Defined in: common/core/src/features/mark/MarkHandler.ts:65

##### Returns

[`MarkToken`](/api/interfaces/marktoken/) \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean | undefined;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:22

##### Returns

`boolean` \| `undefined`

#### Set Signature

```ts
set readOnly(value): void;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:26

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

Defined in: common/core/src/features/mark/MarkHandler.ts:69

##### Returns

[`Token`](/api/type-aliases/token/)[]

***

### value

#### Get Signature

```ts
get value(): string | undefined;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:39

##### Returns

`string` \| `undefined`

#### Set Signature

```ts
set value(v): void;
```

Defined in: common/core/src/features/mark/MarkHandler.ts:43

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

Defined in: common/core/src/features/mark/MarkHandler.ts:73

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

Defined in: common/core/src/features/mark/MarkHandler.ts:82

#### Returns

`void`
