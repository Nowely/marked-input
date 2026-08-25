---
editUrl: false
next: false
prev: false
title: "MarkNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:141](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L141)

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:149](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L149)

***

### descriptor

```ts
readonly descriptor: MarkupDescriptor;
```

Defined in: [core/src/features/tokens/tree/types.ts:144](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L144)

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:143](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L143)

***

### kind

```ts
readonly kind: "mark";
```

Defined in: [core/src/features/tokens/tree/types.ts:142](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L142)

***

### markup

```ts
readonly markup: Markup;
```

Defined in: [core/src/features/tokens/tree/types.ts:146](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L146)

The public view of the descriptor, which is not a public type.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:148](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L148)

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:157](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L157)

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

Defined in: [core/src/features/tokens/tree/types.ts:156](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L156)

Live slot POSITIONS, written by adoption like `position`; `slot()` is the public read
of the slot's TEXT, which is why the two carry different names. Slot text is
deliberately NOT stored: projection, snapshot and adoption equality all derive it from
children, so a stored copy would be an unread mirror nothing resyncs.

***

### value

```ts
readonly value: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:147](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L147)

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:166](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L166)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:167](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L167)

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

Defined in: [core/src/features/tokens/tree/types.ts:168](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L168)

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

Defined in: [core/src/features/tokens/tree/types.ts:169](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L169)

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

Defined in: [core/src/features/tokens/tree/types.ts:161](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L161)

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

Defined in: [core/src/features/tokens/tree/types.ts:165](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L165)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:159](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L159)

The slot's TEXT, joined from the live children. `undefined` for a slotless markup.

#### Returns

`string` \| `undefined`

***

### update()

```ts
update(patch): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:163](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L163)

Rides a transaction; `false` in read-only mode or off the tree.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `patch` | `MarkPatch` |

#### Returns

`boolean`
