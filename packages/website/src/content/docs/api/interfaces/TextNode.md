---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:133](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L133)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:135](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L135)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:134](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L134)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:137](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L137)

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

Defined in: [core/src/features/tokens/tree/types.ts:136](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L136)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:147](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L147)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:148](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L148)

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

Defined in: [core/src/features/tokens/tree/types.ts:149](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L149)

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

Defined in: [core/src/features/tokens/tree/types.ts:150](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L150)

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

Defined in: [core/src/features/tokens/tree/types.ts:144](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L144)

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

Defined in: [core/src/features/tokens/tree/types.ts:146](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L146)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
