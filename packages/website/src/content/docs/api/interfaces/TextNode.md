---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:256](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L256)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:258](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L258)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:257](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L257)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:260](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L260)

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

Defined in: [core/src/features/tokens/tree/types.ts:259](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L259)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:270](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L270)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:271](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L271)

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

Defined in: [core/src/features/tokens/tree/types.ts:272](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L272)

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

Defined in: [core/src/features/tokens/tree/types.ts:267](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L267)

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

Defined in: [core/src/features/tokens/tree/types.ts:269](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L269)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
