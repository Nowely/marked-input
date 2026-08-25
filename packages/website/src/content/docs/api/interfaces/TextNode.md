---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:163](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L163)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:165](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L165)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:164](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L164)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:167](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L167)

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

Defined in: [core/src/features/tokens/tree/types.ts:166](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L166)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:177](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L177)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:178](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L178)

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

Defined in: [core/src/features/tokens/tree/types.ts:179](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L179)

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

Defined in: [core/src/features/tokens/tree/types.ts:180](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L180)

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

Defined in: [core/src/features/tokens/tree/types.ts:174](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L174)

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

Defined in: [core/src/features/tokens/tree/types.ts:176](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L176)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
