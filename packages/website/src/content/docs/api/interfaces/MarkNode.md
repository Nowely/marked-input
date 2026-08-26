---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:325](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L325)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:333](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L333)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:328](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L328)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:327](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L327)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:326](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L326)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:330](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L330)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:332](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L332)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:341](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L341)

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

Defined in: [core/src/features/tokens/tree/types.ts:340](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L340)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:331](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L331)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:350](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L350)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:351](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L351)

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

Defined in: [core/src/features/tokens/tree/types.ts:352](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L352)

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

Defined in: [core/src/features/tokens/tree/types.ts:345](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L345)

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

Defined in: [core/src/features/tokens/tree/types.ts:349](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L349)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:343](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L343)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:347](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L347)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
