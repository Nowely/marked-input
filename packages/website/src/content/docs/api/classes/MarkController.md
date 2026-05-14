---
editUrl: false
next: false
prev: false
title: "MarkController"
---

Defined in: [core/src/features/parsing/MarkController.ts:6](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L6)

## Constructors

### Constructor

```ts
new MarkController(
   store,
   address,
   snapshot): MarkController;
```

Defined in: [core/src/features/parsing/MarkController.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L7)

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

Defined in: [core/src/features/parsing/MarkController.ts:32](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L32)

##### Returns

`string` \| `undefined`

***

### readOnly

#### Get Signature

```ts
get readOnly(): boolean;
```

Defined in: [core/src/features/parsing/MarkController.ts:40](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L40)

##### Returns

`boolean`

***

### slot

#### Get Signature

```ts
get slot(): string | undefined;
```

Defined in: [core/src/features/parsing/MarkController.ts:36](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L36)

##### Returns

`string` \| `undefined`

***

### value

#### Get Signature

```ts
get value(): string;
```

Defined in: [core/src/features/parsing/MarkController.ts:28](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L28)

##### Returns

`string`

## Methods

### remove()

```ts
remove(): void;
```

Defined in: [core/src/features/parsing/MarkController.ts:44](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L44)

#### Returns

`void`

***

### update()

```ts
update(patch): void;
```

Defined in: [core/src/features/parsing/MarkController.ts:50](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L50)

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

Defined in: [core/src/features/parsing/MarkController.ts:13](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/parsing/MarkController.ts#L13)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `store` | `Store` |
| `token` | [`MarkToken`](/api/interfaces/marktoken/) |

#### Returns

`MarkController`
