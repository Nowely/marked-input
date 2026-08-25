---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:270](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L270)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:272](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L272)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:271](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L271)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:274](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L274)

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

Defined in: [core/src/features/tokens/tree/types.ts:273](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L273)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:284](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L284)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:285](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L285)

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

Defined in: [core/src/features/tokens/tree/types.ts:286](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L286)

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

Defined in: [core/src/features/tokens/tree/types.ts:281](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L281)

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

Defined in: [core/src/features/tokens/tree/types.ts:283](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L283)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
