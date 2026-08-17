---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:72](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L72)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:80](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L80)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:75](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L75)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:74](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L74)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:73](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L73)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:77](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L77)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:79](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L79)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:88](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L88)

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

Defined in: [core/src/features/tokens/tree/types.ts:87](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L87)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:78](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L78)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:97](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L97)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:98](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L98)

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

Defined in: [core/src/features/tokens/tree/types.ts:99](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L99)

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

Defined in: [core/src/features/tokens/tree/types.ts:100](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L100)

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

Defined in: [core/src/features/tokens/tree/types.ts:92](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L92)

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

Defined in: [core/src/features/tokens/tree/types.ts:96](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L96)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:90](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L90)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:94](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L94)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | [`MarkPatch`](/api/type-aliases/markpatch/) |

#### Returns

`boolean`
