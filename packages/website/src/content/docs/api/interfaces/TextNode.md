---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:302](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L302)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:304](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L304)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:303](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L303)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:306](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L306)

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

Defined in: [core/src/features/tokens/tree/types.ts:305](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L305)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:316](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L316)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:317](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L317)

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

Defined in: [core/src/features/tokens/tree/types.ts:318](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L318)

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

Defined in: [core/src/features/tokens/tree/types.ts:313](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L313)

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

Defined in: [core/src/features/tokens/tree/types.ts:315](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L315)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
