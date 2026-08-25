---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:263](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L263)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:265](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L265)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:264](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L264)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:267](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L267)

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

Defined in: [core/src/features/tokens/tree/types.ts:266](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L266)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:277](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L277)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:278](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L278)

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

Defined in: [core/src/features/tokens/tree/types.ts:279](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L279)

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

Defined in: [core/src/features/tokens/tree/types.ts:274](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L274)

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

Defined in: [core/src/features/tokens/tree/types.ts:276](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L276)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
