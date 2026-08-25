---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:229](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L229)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:231](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L231)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:230](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L230)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:233](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L233)

#### end

```ts
end: number;
```

#### start

```ts
start: number;
```

***

### text

```ts
readonly text: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:232](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L232)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:243](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L243)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:244](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L244)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |

#### Returns

`boolean`

***

### mergeWith()

```ts
mergeWith(next): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:245](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L245)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `next` | [`TreeNode`](/api/type-aliases/treenode/) |

#### Returns

`boolean`

***

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:240](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L240)

The derived positional read. NOT reactive: `position` is a plain field written by
adoption, so a consumer that must react to a move watches `changed` or the content
signals instead. Returns a COPY — the stored record is adoption's, and handing it out
would let a caller corrupt the coordinate space every splice is computed in.

#### Returns

`object`

##### end

```ts
end: number;
```

##### start

```ts
start: number;
```

***

### remove()

```ts
remove(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:242](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L242)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
