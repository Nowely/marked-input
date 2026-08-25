---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:171](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L171)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:173](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L173)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:172](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L172)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:175](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L175)

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

Defined in: [core/src/features/tokens/tree/types.ts:174](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L174)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:185](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L185)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:186](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L186)

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

Defined in: [core/src/features/tokens/tree/types.ts:187](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L187)

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

Defined in: [core/src/features/tokens/tree/types.ts:188](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L188)

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

Defined in: [core/src/features/tokens/tree/types.ts:182](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L182)

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

Defined in: [core/src/features/tokens/tree/types.ts:184](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L184)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
