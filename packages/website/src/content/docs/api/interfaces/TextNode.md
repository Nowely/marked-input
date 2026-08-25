---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:192](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L192)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:194](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L194)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:193](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L193)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:196](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L196)

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

Defined in: [core/src/features/tokens/tree/types.ts:195](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L195)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:206](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L206)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:207](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L207)

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

Defined in: [core/src/features/tokens/tree/types.ts:208](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L208)

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

Defined in: [core/src/features/tokens/tree/types.ts:203](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L203)

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

Defined in: [core/src/features/tokens/tree/types.ts:205](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L205)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
