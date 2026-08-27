---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:318](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L318)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:320](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L320)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:319](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L319)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:322](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L322)

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

Defined in: [core/src/features/tokens/tree/types.ts:321](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L321)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:332](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L332)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:333](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L333)

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

Defined in: [core/src/features/tokens/tree/types.ts:334](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L334)

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

Defined in: [core/src/features/tokens/tree/types.ts:329](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L329)

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

Defined in: [core/src/features/tokens/tree/types.ts:331](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L331)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
