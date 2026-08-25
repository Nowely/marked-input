---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:255](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L255)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:263](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L263)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:258](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L258)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:257](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L257)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:256](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L256)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:260](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L260)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:262](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L262)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:271](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L271)

#### end

```ts
end: number;
```

#### start

```ts
start: number;
```

***

### slotRange

```ts
slotRange:
  | {
  end: number;
  start: number;
}
  | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:270](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L270)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:261](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L261)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:280](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L280)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:281](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L281)

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

Defined in: [core/src/features/tokens/tree/types.ts:282](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L282)

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

Defined in: [core/src/features/tokens/tree/types.ts:275](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L275)

See [TextNode.range](/api/interfaces/textnode/#range).

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

Defined in: [core/src/features/tokens/tree/types.ts:279](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L279)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:273](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L273)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:277](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L277)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
