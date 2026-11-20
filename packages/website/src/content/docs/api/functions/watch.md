---
editUrl: false
next: false
prev: false
title: "watch"
---

## Call Signature

```ts
function watch<T>(
   dep,
   fn,
   opts?
): () => void;
```

Defined in: [core/src/shared/signals/signal.ts:659](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/signals/signal.ts#L659)

### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-t"></a> `T` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `dep` | `Signal`\<`T`\> |
| `fn` | (`newValue`, `oldValue`) => `void` |
| `opts?` | `WatchOptions` |

### Returns

() => `void`

## Call Signature

```ts
function watch<T>(
   dep,
   fn,
   opts?
): () => void;
```

Defined in: [core/src/shared/signals/signal.ts:664](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/signals/signal.ts#L664)

### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-t-1"></a> `T` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `dep` | `Event`\<`T`\> |
| `fn` | (`newValue`, `oldValue`) => `void` |
| `opts?` | `WatchOptions` |

### Returns

() => `void`

## Call Signature

```ts
function watch<T>(
   dep,
   fn,
   opts?
): () => void;
```

Defined in: [core/src/shared/signals/signal.ts:669](https://github.com/Nowely/marked-input/blob/next/packages/core/src/shared/signals/signal.ts#L669)

### Type Parameters

| Type Parameter |
| ------ |
| <a id="type-parameter-t-2"></a> `T` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `dep` | () => `T` |
| `fn` | (`newValue`, `oldValue`) => `void` |
| `opts?` | `WatchOptions` |

### Returns

() => `void`
