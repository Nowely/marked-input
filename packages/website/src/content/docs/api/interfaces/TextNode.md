---
editUrl: false
next: false
prev: false
title: "TextNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:236](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L236)

## Properties

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:238](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L238)

***

### kind

```ts
readonly kind: "text";
```

Defined in: [core/src/features/tokens/tree/types.ts:237](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L237)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:240](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L240)

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

Defined in: [core/src/features/tokens/tree/types.ts:239](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L239)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:250](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L250)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:251](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L251)

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

Defined in: [core/src/features/tokens/tree/types.ts:252](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L252)

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

Defined in: [core/src/features/tokens/tree/types.ts:247](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L247)

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

Defined in: [core/src/features/tokens/tree/types.ts:249](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L249)

See NodeCommands. Each rides a transaction; `false` in read-only mode or off the tree.

#### Returns

`boolean`
