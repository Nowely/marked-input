---
editUrl: false
next: false
prev: false
title: "RowNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:57](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L57)

A first-class block row (issue 08): block layout's only root kind, carved by the row scanner
from the structural separator and TYPED by its own opener (ADR-0010). Never a child of a mark
or another row. A paragraph is a Row with no kind at all — its children are the plain text and
inline marks of the whole line.

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:76](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L76)

INLINE children first, then CHILD ROWS. ONE list, so every generic walk in `tree/`, `bind`
and `transactions` stays untouched by nesting; [inline](/api/interfaces/rownode/#inline) and [rows](/api/interfaces/rownode/#rows) are the two
named halves the caret mapping and the renderer need.

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

### lead

```ts
lead: string;
```

Defined in: [core/src/features/tokens/tree/types.ts:93](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L93)

Structural bytes BEFORE the body: the indent run this row is nested by. Adoption-written,
like [position](/api/interfaces/rownode/#position). It is the ROUND-TRIP BYTES and depth is the TREE, and there is no
function from one to the other — an over-indented paste keeps its surplus here while the
clamp renders it shallower.

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

Defined in: [core/src/features/tokens/tree/types.ts:98](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L98)

INCLUDES the trailing separator on every row but the document-final one, and the row's
whole SUBTREE. See [lineRange](/api/interfaces/rownode/#linerange) for the row's own line alone.

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

Defined in: [core/src/features/tokens/tree/types.ts:115](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L115)

#### Returns

`boolean`

***

### inline()

```ts
inline(): readonly TreeNode[];
```

Defined in: [core/src/features/tokens/tree/types.ts:78](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L78)

The row's own inline content — Text and Mark nodes only, at least one text child.

#### Returns

readonly [`TreeNode`](/api/type-aliases/treenode/)[]

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:116](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L116)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `text` | `string` |

#### Returns

`boolean`

***

### lineRange()

```ts
lineRange(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:103](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L103)

The row's own LINE — its lead, its body and its own separator, the nested subtree
excluded. Derived, because a row's line ends exactly where its first child row begins.

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

### mergeWith()

```ts
mergeWith(next): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:117](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L117)

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

Defined in: [core/src/features/tokens/tree/types.ts:118](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L118)

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

Defined in: [core/src/features/tokens/tree/types.ts:86](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L86)

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

Defined in: [core/src/features/tokens/tree/types.ts:112](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L112)

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

Defined in: [core/src/features/tokens/tree/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L114)

See NodeCommands.

#### Returns

`boolean`

***

### rows()

```ts
rows(): readonly RowNode[];
```

Defined in: [core/src/features/tokens/tree/types.ts:80](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L80)

The rows nested under this one.

#### Returns

readonly `RowNode`[]

***

### slot()

```ts
slot(): string;
```

Defined in: [core/src/features/tokens/tree/types.ts:110](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L110)

The interior's TEXT, joined from the live inline children.

#### Returns

`string`

***

### slotRange()

```ts
slotRange(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:108](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L108)

The row's own editable interior — everything its opener and closing literal enclose.
DERIVED from the INLINE children's outer edges, which is exactly what the parse put there.

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
