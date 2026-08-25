---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:98](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L98)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:100](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L100)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:99](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L99)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:102](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L102)

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

Defined in: [core/src/features/tokens/tree/types.ts:101](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L101)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:112](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L112)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:113](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L113)

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

Defined in: [core/src/features/tokens/tree/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L114)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `next` | [`TreeNode`](/api/type-aliases/treenode/) |

#### Returns

`boolean`

***

### moveTo()

```ts
moveTo(index): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:115](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L115)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `index` | `number` |

#### Returns

`boolean`

***

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:109](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L109)

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

Defined in: [core/src/features/tokens/tree/types.ts:111](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L111)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
