---
editUrl: false
next: false
prev: false
title: "RowNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L57)

A first-class block row (issue 08): block layout's only root kind, carved by the row scanner
from the structural separator and TYPED by its own opener (ADR-0011). Never a child of a mark
or another row. A paragraph is a Row with no kind at all — its children are the plain text and
inline marks of the whole line.

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:72](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L72)

The row's inline content — Text and Mark nodes only, at least one text child.

***

### descriptor

```ts
readonly descriptor: Signal<MarkupDescriptor | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:68](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L68)

THE row's kind: the compiled markup its opener matched, `undefined` for a paragraph.

A SIGNAL, unlike [MarkNode.descriptor](/api/interfaces/marknode/#descriptor), and that difference is the design: a mark IS
its markup, so adopting across descriptors would leave a node disagreeing with the parse; a
row HAS a kind, and a turn-into must keep the row's identity — its id, its element, its
drag grip — while the kind changes underneath it.

***

### id

```ts
readonly id: number;
```

Defined in: [core/src/features/tokens/tree/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L59)

***

### kind

```ts
readonly kind: "row";
```

Defined in: [core/src/features/tokens/tree/types.ts:58](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L58)

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:70](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L70)

The kind's metadata gap — a todo's checked flag, a fence's language.

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:80](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L80)

INCLUDES the trailing separator on every row but the document-final one.

#### end

```ts
end: number;
```

#### start

```ts
start: number;
```

## Methods

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:92](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L92)

#### Returns

`boolean`

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:93](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L93)

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

Defined in: [core/src/features/tokens/tree/types.ts:94](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L94)

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

Defined in: [core/src/features/tokens/tree/types.ts:95](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L95)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `index` | `number` |

#### Returns

`boolean`

***

### option()

```ts
option(): number | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:78](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L78)

The public view of the kind: the index of the option that declared it, which is the same
identity `resolveSlot` already resolves a mark's component by. `undefined` for a paragraph.
Derived from [descriptor](/api/interfaces/rownode/#descriptor), so the two cannot disagree.

#### Returns

`number` \| `undefined`

***

### range()

```ts
range(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:89](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L89)

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

Defined in: [core/src/features/tokens/tree/types.ts:91](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L91)

See NodeCommands.

#### Returns

`boolean`

***

### slot()

```ts
slot(): string;
```

Defined in: [core/src/features/tokens/tree/types.ts:87](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L87)

The interior's TEXT, joined from the live children.

#### Returns

`string`

***

### slotRange()

```ts
slotRange(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:85](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L85)

The row's own editable interior — everything its opener and closing literal enclose.
DERIVED from the children's outer edges, which is exactly what the parse put there.

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
