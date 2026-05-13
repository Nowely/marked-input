---
editUrl: false
next: false
prev: false
title: "MarkputHandler"
---

Defined in: [core/src/shared/classes/MarkputHandler.ts:6](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/classes/MarkputHandler.ts#L6)

## Constructors

### Constructor

```ts
new MarkputHandler(
   dom,
   overlayFeature,
   parsing,
   caret): MarkputHandler;
```

Defined in: [core/src/shared/classes/MarkputHandler.ts:7](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/classes/MarkputHandler.ts#L7)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `dom` | `DomModel` |
| `overlayFeature` | `OverlayController` |
| `parsing` | `ParseController` |
| `caret` | `CaretModel` |

#### Returns

`MarkputHandler`

## Accessors

### container

#### Get Signature

```ts
get container(): HTMLElement | null;
```

Defined in: [core/src/shared/classes/MarkputHandler.ts:14](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/classes/MarkputHandler.ts#L14)

##### Returns

`HTMLElement` \| `null`

***

### overlay

#### Get Signature

```ts
get overlay(): HTMLElement | null;
```

Defined in: [core/src/shared/classes/MarkputHandler.ts:18](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/classes/MarkputHandler.ts#L18)

##### Returns

`HTMLElement` \| `null`

## Methods

### focus()

```ts
focus(): void;
```

Defined in: [core/src/shared/classes/MarkputHandler.ts:22](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/classes/MarkputHandler.ts#L22)

#### Returns

`void`
