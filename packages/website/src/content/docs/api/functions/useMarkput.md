---
editUrl: false
next: false
prev: false
title: "useMarkput"
---

## Call Signature

```ts
function useMarkput<T>(selector): T;
```

Defined in: [react/markput/src/lib/hooks/useMarkput.ts:12](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useMarkput.ts#L12)

### Type Parameters

| Type Parameter |
| ------ |
| `T` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `selector` | (`store`) => `Selectable`\<`T`\> |

### Returns

`T`

## Call Signature

```ts
function useMarkput<R>(selector): SignalValues<R>;
```

Defined in: [react/markput/src/lib/hooks/useMarkput.ts:13](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useMarkput.ts#L13)

### Type Parameters

| Type Parameter |
| ------ |
| `R` *extends* `ObjectSelector` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `selector` | (`store`) => `R` |

### Returns

`SignalValues`\<`R`\>

## Call Signature

```ts
function useMarkput<T>(selector): T;
```

Defined in: [react/markput/src/lib/hooks/useMarkput.ts:20](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useMarkput.ts#L20)

A member of the store with nothing reactive about it — `s.rows`, `s.edit`, `s.tokens`. It is
handed back AS IT IS, identity and all, because a controller outlives every render of the
editor and there is nothing here for a snapshot to differ on. Ordered last, so an object
literal of signals still takes the unwrapping overload above it.

### Type Parameters

| Type Parameter |
| ------ |
| `T` *extends* `object` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `selector` | (`store`) => `T` |

### Returns

`T`
