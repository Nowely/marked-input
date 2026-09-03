---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:342](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L342)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:350](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L350)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:345](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L345)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:344](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L344)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:343](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L343)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:347](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L347)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:349](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L349)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:358](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L358)

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

Defined in: [core/src/features/tokens/tree/types.ts:357](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L357)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:348](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L348)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:367](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L367)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:368](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L368)

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

Defined in: [core/src/features/tokens/tree/types.ts:369](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L369)

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

Defined in: [core/src/features/tokens/tree/types.ts:362](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L362)

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

Defined in: [core/src/features/tokens/tree/types.ts:366](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L366)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:360](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L360)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:364](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L364)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
