---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:81](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L81)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:83](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L83)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:82](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L82)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:85](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L85)

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

Defined in: [core/src/features/tokens/tree/types.ts:84](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L84)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:95](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L95)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:96](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L96)

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

Defined in: [core/src/features/tokens/tree/types.ts:97](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L97)

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

Defined in: [core/src/features/tokens/tree/types.ts:98](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L98)

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

Defined in: [core/src/features/tokens/tree/types.ts:92](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L92)

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

Defined in: [core/src/features/tokens/tree/types.ts:94](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L94)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
