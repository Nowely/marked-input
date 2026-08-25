---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:121](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L121)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:123](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L123)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:122](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L122)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:125](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L125)

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

Defined in: [core/src/features/tokens/tree/types.ts:124](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L124)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:135](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L135)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:136](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L136)

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

Defined in: [core/src/features/tokens/tree/types.ts:137](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L137)

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

Defined in: [core/src/features/tokens/tree/types.ts:138](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L138)

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

Defined in: [core/src/features/tokens/tree/types.ts:132](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L132)

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

Defined in: [core/src/features/tokens/tree/types.ts:134](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L134)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
