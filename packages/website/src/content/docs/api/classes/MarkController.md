---
editUrl: false
next: false
prev: false
title: "MarkController"
---

Defined in: [core/src/features/mark/MarkController.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L7)

## Constructors

### Constructor

```ts
new MarkController(
   store,
   address,
   snapshot,
   shape): MarkController;
```

Defined in: [core/src/features/mark/MarkController.ts:10](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L10)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `address` | `TokenAddress` |
| `snapshot` | `MarkSnapshot` |
| `shape` | `TokenShapeSnapshot` |

#### Returns

`MarkController`

## Accessors

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [core/src/features/mark/MarkController.ts:43](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L43)

##### Returns

`string` \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean;
```

Defined in: [core/src/features/mark/MarkController.ts:51](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L51)

##### Returns

`boolean`

***

### slot

#### Get Signature

```ts
get slot(): string | undefined;
```

Defined in: [core/src/features/mark/MarkController.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L47)

##### Returns

`string` \| `undefined`

***

### value

#### Get Signature

```ts
get value(): string;
```

Defined in: [core/src/features/mark/MarkController.ts:39](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L39)

##### Returns

`string`

## Methods

### remove()

```ts
remove(): EditResult;
```

Defined in: [core/src/features/mark/MarkController.ts:55](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L55)

#### Returns

`EditResult`

***

### update()

```ts
update(patch): EditResult;
```

Defined in: [core/src/features/mark/MarkController.ts:61](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L61)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`EditResult`

***

### fromToken()

```ts
static fromToken(store, token): MarkController;
```

Defined in: [core/src/features/mark/MarkController.ts:19](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/mark/MarkController.ts#L19)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `token` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkController`
