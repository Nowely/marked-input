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
