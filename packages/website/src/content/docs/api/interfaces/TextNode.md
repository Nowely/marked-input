---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:208](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L208)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:210](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L210)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:209](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L209)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:212](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L212)

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

Defined in: [core/src/features/tokens/tree/types.ts:211](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L211)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:222](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L222)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:223](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L223)

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

Defined in: [core/src/features/tokens/tree/types.ts:224](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L224)

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

Defined in: [core/src/features/tokens/tree/types.ts:219](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L219)

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

Defined in: [core/src/features/tokens/tree/types.ts:221](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L221)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
