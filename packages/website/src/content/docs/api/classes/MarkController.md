---
editUrl: false
next: false
prev: false
title: "MarkController"
---

Defined in: [core/src/features/tokens/MarkController.ts:6](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L6)

## Constructors

### Constructor

```ts
new MarkController(
   store,
   address,
   snapshot): MarkController;
```

Defined in: [core/src/features/tokens/MarkController.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `address` | `TokenAddress` |
| `snapshot` | `MarkSnapshot` |

#### Returns

`MarkController`

## Accessors

### meta

#### Get Signature

```ts
get meta(): string | undefined;
```

Defined in: [core/src/features/tokens/MarkController.ts:41](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L41)

##### Returns

`string` \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:49](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L49)

##### Returns

`boolean`

***

### slot

#### Get Signature

```ts
get slot(): string | undefined;
```

Defined in: [core/src/features/tokens/MarkController.ts:45](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L45)

##### Returns

`string` \| `undefined`

***

### value

#### Get Signature

```ts
get value(): string;
```

Defined in: [core/src/features/tokens/MarkController.ts:37](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L37)

##### Returns

`string`

## Methods

### remove()

```ts
remove(): void;
```

Defined in: [core/src/features/tokens/MarkController.ts:53](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L53)

#### Returns

`void`

***

### update()

```ts
update(patch): void;
```

Defined in: [core/src/features/tokens/MarkController.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L59)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`void`

***

### fromToken()

```ts
static fromToken(store, token): MarkController;
```

Defined in: [core/src/features/tokens/MarkController.ts:13](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `token` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkController`
