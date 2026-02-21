---
editUrl: false
next: false
prev: false
title: "useListener"
---

## Call Signature

```ts
function useListener<T>(
   key, 
   listener, 
   deps?): void;
```

Defined in: [react/markput/src/lib/hooks/useListener.tsx:7](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useListener.tsx#L7)

### Type Parameters

| Type Parameter |
| ------ |
| `T` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `EventKey`\<`T`\> |
| `listener` | `Listener`\<`T`\> |
| `deps?` | `DependencyList` |

### Returns

`void`

## Call Signature

```ts
function useListener<K>(
   key, 
   listener, 
   deps?): void;
```

Defined in: [react/markput/src/lib/hooks/useListener.tsx:8](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useListener.tsx#L8)

### Type Parameters

| Type Parameter |
| ------ |
| `K` *extends* keyof `HTMLElementEventMap` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `key` | `K` |
| `listener` | `Listener`\<`HTMLElementEventMap`\[`K`\]\> |
| `deps?` | `DependencyList` |

### Returns

`void`
