---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:52](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L52)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:54](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L54)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:53](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L53)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:56](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L56)

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

Defined in: [core/src/features/tokens/tree/types.ts:55](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L55)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:66](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L66)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:67](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L67)

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

Defined in: [core/src/features/tokens/tree/types.ts:68](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L68)

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

Defined in: [core/src/features/tokens/tree/types.ts:69](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L69)

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

Defined in: [core/src/features/tokens/tree/types.ts:63](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L63)

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

Defined in: [core/src/features/tokens/tree/types.ts:65](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L65)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
