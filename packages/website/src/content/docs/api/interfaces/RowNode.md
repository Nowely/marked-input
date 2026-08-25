---
editUrl: false
next: false
prev: false
title: "RowNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:58](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L58)

A first-class block row (issue 08): block layout's only root kind, carved by the row scanner
from the structural separator and TYPED by its own opener (ADR-0010). Never a child of a mark
or another row. A paragraph is a Row with no kind at all — its children are the plain text and
inline marks of the whole line.

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:77](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L77)

INLINE children first, then CHILD ROWS. ONE list, so every generic walk in `tree/`, `bind`
and `transactions` stays untouched by nesting; [inline](/api/interfaces/rownode/#inline) and [rows](/api/interfaces/rownode/#rows) are the two
named halves the caret mapping and the renderer need.

***

### descriptor

```ts
readonly descriptor: Signal<MarkupDescriptor | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:69](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L69)

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

Defined in: [core/src/features/tokens/tree/types.ts:60](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L60)

***

### kind

```ts
readonly kind: "row";
```

Defined in: [core/src/features/tokens/tree/types.ts:59](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L59)

***

### lead

```ts
readonly lead: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:98](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L98)

Structural bytes BEFORE the body: the indent run this row is nested by. It is the ROUND-TRIP
BYTES and depth is the TREE, and there is no function from one to the other — an
over-indented paste keeps its surplus here while the clamp renders it shallower.

A SIGNAL rather than a plain field beside [position](/api/interfaces/rownode/#position), and the difference is not
cosmetic: the projection EMITS the lead, so a re-indent that leaves every child object in
place would otherwise change no signal at all and `value` would keep answering the string
from before the Tab.

***

### meta

```ts
readonly meta: Signal<string | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:71](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L71)

The kind's metadata gap — a todo's checked flag, a fence's language.

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:103](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L103)

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

Defined in: [core/src/features/tokens/tree/types.ts:165](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L165)

#### Returns

`boolean`

***

### inline()

```ts
inline(): readonly TreeNode[];
```

Defined in: [core/src/features/tokens/tree/types.ts:79](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L79)

The row's own inline content — Text and Mark nodes only, at least one text child.

#### Returns

readonly [`TreeNode`](/api/type-aliases/treenode/)[]

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:166](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L166)

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

Defined in: [core/src/features/tokens/tree/types.ts:108](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L108)

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

Defined in: [core/src/features/tokens/tree/types.ts:167](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L167)

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `next` | [`TreeNode`](/api/type-aliases/treenode/) |

#### Returns

`boolean`

***

### moveTo()

```ts
moveTo(placement): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:182](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L182)

Move this row AND ITS SUBTREE to `placement`, keeping every row's identity — the moved
subtree's, its old siblings' and its new siblings'. The subtree is re-indented to sit under
its new parent, which NORMALIZES a surplus indent run exactly as [setDepth](/api/interfaces/rownode/#setdepth) does.

`false` for a placement inside the moved row's OWN subtree — a row cannot become its own
descendant — and for a dead row on either end, an index outside the destination's child
list, a no-op, an editor with no separator to rejoin rows by, and a nested placement in an
editor with nesting off. "An empty row takes no children" refuses at both ends: a placement
UNDER an empty row, and a move that would re-lead a row carrying children into an empty one
— a blank row is non-empty only while it carries an indent. It also refuses a move that
would change where the row AFTER it parses, which is reachable only for a row whose lead
carries a surplus indent run some earlier paste left on it.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `placement` | [`RowPlacement`](/api/type-aliases/rowplacement/) |

#### Returns

`boolean`

***

### option()

```ts
option(): number | undefined;
```

Defined in: [core/src/features/tokens/tree/types.ts:87](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L87)

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

Defined in: [core/src/features/tokens/tree/types.ts:117](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L117)

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

Defined in: [core/src/features/tokens/tree/types.ts:164](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L164)

See NodeCommands.

#### Returns

`boolean`

***

### rows()

```ts
rows(): readonly RowNode[];
```

Defined in: [core/src/features/tokens/tree/types.ts:81](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L81)

The rows nested under this one.

#### Returns

readonly `RowNode`[]

***

### setDepth()

```ts
setDepth(depth): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:125](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L125)

Re-indent this row to `depth`, rewriting its whole lead. `false` for a depth deeper than
one past the row before it, for a no-op, and for an editor with nesting off.

It NORMALIZES a surplus indent run — see [lead](/api/interfaces/rownode/#lead): the bytes a paste preserved are lost
the first time a row is re-indented, which is the price of depth having one reading.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `depth` | `number` |

#### Returns

`boolean`

***

### slot()

```ts
slot(): string;
```

Defined in: [core/src/features/tokens/tree/types.ts:115](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L115)

The interior's TEXT, joined from the live inline children.

#### Returns

`string`

***

### slotRange()

```ts
slotRange(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:113](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L113)

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

***

### splitAt()

```ts
splitAt(at): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:162](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L162)

Split this row at `at`: the body before the anchor stays, the body after it becomes a new row
at the same lead, whose kind is this one when the kind `continues` and a plain row otherwise.
A continuing kind carries its `meta` into the tail with it, so splitting a checked to-do
gives two checked to-dos.

The tail lands after this row's whole SUBTREE, not after its line, and that is forced rather
than chosen: nesting is indentation and nothing else, so a row written directly under this
one at this one's lead would adopt every child it has. Placing it past the subtree is the
only reading under which a split never re-parents a row it was not asked about. The one
exception is the head that EMPTIES — an empty row takes no children — where the subtree
follows the tail instead, which is Enter at a row's start.

`false` for a non-row, for an editor with no separator to split at, and for an anchor outside
this row's own body — a caret in another row cannot address this one's split point.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `at` | [`NodeAnchor`](/api/type-aliases/nodeanchor/) |

#### Returns

`boolean`

***

### turnInto()

```ts
turnInto(option, patch?): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:145](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L145)

Retype this row: its kind becomes the one `option` declares, or a paragraph for `undefined`.
The splice is the row's own LINE, so its id, its element and its child rows are untouched —
which is what a row HAVING a kind rather than being one buys (ADR-0007).

`patch.text` REPLACES the body, and it exists so a caller can strip a span and retype in ONE
splice: the slash menu removes its own trigger and applies the kind in a single commit,
which two verbs could not do without an intermediate state the parse would see.

`false` for an option this editor compiles no row kind from — a mark option, one whose
markup was reported and dropped, or one that is not in `options` at all — and for a no-op.

REPARSE DECIDES what comes back, as it does for a merge: a body carrying the separator
becomes two rows, and a body whose own start matches a longer opener types as THAT kind.
ONE consequence is worth naming, because it is the one case where the child rows are NOT
untouched: retyping a row at depth 0 whose body is empty leaves an empty LINE, and an empty
row takes no children, so the scan promotes them to roots. The encoding cannot express an
empty parent; the surplus indent survives verbatim in each child's `lead`.

#### Parameters

| Parameter | Type |
| ------ | ------ |
| `option` | `CoreOption` \| `undefined` |
| `patch?` | `RowPatch` |

#### Returns

`boolean`
