---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:248](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L248)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:256](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L256)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:251](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L251)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:250](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L250)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:249](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L249)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:253](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L253)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:255](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L255)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:264](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L264)

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

Defined in: [core/src/features/tokens/tree/types.ts:263](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L263)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:254](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L254)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:273](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L273)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:274](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L274)

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

Defined in: [core/src/features/tokens/tree/types.ts:275](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L275)

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

Defined in: [core/src/features/tokens/tree/types.ts:268](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L268)

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

Defined in: [core/src/features/tokens/tree/types.ts:272](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L272)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:266](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L266)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:270](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L270)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
