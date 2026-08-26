---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:300](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L300)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:302](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L302)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:301](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L301)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:304](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L304)

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

Defined in: [core/src/features/tokens/tree/types.ts:303](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L303)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:314](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L314)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:315](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L315)

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

Defined in: [core/src/features/tokens/tree/types.ts:316](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L316)

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

Defined in: [core/src/features/tokens/tree/types.ts:311](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L311)

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

Defined in: [core/src/features/tokens/tree/types.ts:313](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L313)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
