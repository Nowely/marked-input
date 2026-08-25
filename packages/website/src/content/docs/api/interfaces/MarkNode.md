---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:118](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L118)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:126](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L126)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:121](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L121)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:120](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L120)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:119](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L119)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:123](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L123)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:125](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L125)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:134](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L134)

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

Defined in: [core/src/features/tokens/tree/types.ts:133](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L133)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:124](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L124)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:143](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L143)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:144](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L144)

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

Defined in: [core/src/features/tokens/tree/types.ts:145](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L145)

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

Defined in: [core/src/features/tokens/tree/types.ts:146](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L146)

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

Defined in: [core/src/features/tokens/tree/types.ts:138](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L138)

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

Defined in: [core/src/features/tokens/tree/types.ts:142](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L142)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:136](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L136)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:140](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L140)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
