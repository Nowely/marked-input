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

Defined in: [react/markput/src/lib/hooks/useMarkput.ts:28](https://github.com/Nowely/marked-input/blob/next/packages/react/markput/src/lib/hooks/useMarkput.ts#L28)

A member of the store with nothing reactive about it — `s.rows`, `s.edit`, `s.tokens`. It is
handed back AS IT IS, identity and all, because a controller outlives every render of the
editor and there is nothing here for a snapshot to differ on. Ordered last, so an object
literal of signals still takes the unwrapping overload above it.

THE CONSTRAINT NAMES THE THREE RATHER THAN SAYING `object`, because `object` is satisfied by
every non-primitive and would turn two compile errors into silent wrong answers: a CALLED signal
(`s.rows.selected()`) is an array, which `readSelected` hands straight back — the snapshot then
reads nothing reactive and is frozen at mount forever — and an INTERFACE-typed return gets no
implicit index signature, so it keeps its wrapped type while the runtime unwraps it key by key.
`Store[keyof Store]` does not work either: `KeyboardController` is structurally empty, so the
union swallows anything. The list grows when a fourth member needs selecting.

### Type Parameters

| Type Parameter |
| ------ |
| `T` *extends* `TokenModel` \| `EditController` \| `RowController` |

### Parameters

| Parameter | Type |
| ------ | ------ |
| `selector` | (`store`) => `T` |

### Returns

`T`
