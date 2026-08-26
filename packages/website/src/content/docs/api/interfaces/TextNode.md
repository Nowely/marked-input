---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:288](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L288)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:290](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L290)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:289](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L289)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:292](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L292)

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

Defined in: [core/src/features/tokens/tree/types.ts:291](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L291)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:302](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L302)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:303](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L303)

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

Defined in: [core/src/features/tokens/tree/types.ts:304](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L304)

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

Defined in: [core/src/features/tokens/tree/types.ts:299](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L299)

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

Defined in: [core/src/features/tokens/tree/types.ts:301](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L301)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
