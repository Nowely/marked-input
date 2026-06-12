---
editUrl: false
next: false
prev: false
title: "MarkController"
---

Defined in: [core/src/features/tokens/MarkController.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L7)

## Constructors

### Constructor

```ts
new MarkController(
   store,
   address,
   snapshot): MarkController;
```

Defined in: [core/src/features/tokens/MarkController.ts:8](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L8)

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

Defined in: [core/src/features/tokens/MarkController.ts:39](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L39)

##### Returns

`string` \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean;
```

Defined in: [core/src/features/tokens/MarkController.ts:47](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L47)

##### Returns

`boolean`

***

### slot

#### Get Signature

```ts
get slot(): string | undefined;
```

Defined in: [core/src/features/tokens/MarkController.ts:43](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L43)

##### Returns

`string` \| `undefined`

***

### value

#### Get Signature

```ts
get value(): string;
```

Defined in: [core/src/features/tokens/MarkController.ts:35](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L35)

##### Returns

`string`

## Methods

### remove()

```ts
remove(): void;
```

Defined in: [core/src/features/tokens/MarkController.ts:51](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L51)

#### Returns

`void`

***

### update()

```ts
update(patch): void;
```

Defined in: [core/src/features/tokens/MarkController.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L57)

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

Defined in: [core/src/features/tokens/MarkController.ts:14](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/MarkController.ts#L14)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `token` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkController`
