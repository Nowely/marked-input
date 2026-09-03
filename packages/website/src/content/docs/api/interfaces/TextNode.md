---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:323](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L323)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:325](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L325)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:324](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L324)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:327](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L327)

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

Defined in: [core/src/features/tokens/tree/types.ts:326](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L326)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:337](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L337)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:338](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L338)

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

Defined in: [core/src/features/tokens/tree/types.ts:339](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L339)

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

Defined in: [core/src/features/tokens/tree/types.ts:334](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L334)

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

Defined in: [core/src/features/tokens/tree/types.ts:336](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L336)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
