---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:101](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L101)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:109](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L109)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:104](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L104)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:103](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L103)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:102](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L102)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:106](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L106)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:108](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L108)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:117](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L117)

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

Defined in: [core/src/features/tokens/tree/types.ts:116](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L116)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:107](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L107)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:126](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L126)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:127](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L127)

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

Defined in: [core/src/features/tokens/tree/types.ts:128](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L128)

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

Defined in: [core/src/features/tokens/tree/types.ts:129](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L129)

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

Defined in: [core/src/features/tokens/tree/types.ts:121](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L121)

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

Defined in: [core/src/features/tokens/tree/types.ts:125](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L125)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:119](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L119)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:123](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L123)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
