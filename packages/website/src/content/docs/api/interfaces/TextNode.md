---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:150](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L150)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:152](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L152)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:151](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L151)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:154](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L154)

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

Defined in: [core/src/features/tokens/tree/types.ts:153](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L153)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:164](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L164)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:165](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L165)

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

Defined in: [core/src/features/tokens/tree/types.ts:166](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L166)

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

Defined in: [core/src/features/tokens/tree/types.ts:167](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L167)

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

Defined in: [core/src/features/tokens/tree/types.ts:161](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L161)

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

Defined in: [core/src/features/tokens/tree/types.ts:163](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L163)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
