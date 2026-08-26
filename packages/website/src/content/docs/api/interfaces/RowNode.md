---
editUrl: false
next: false
prev: false
title: "RowNode"
---

Defined in: [core/src/features/tokens/tree/types.ts:85](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L85)

A first-class block row (issue 08): block layout's only root kind, carved by the row scanner
from the structural separator and TYPED by its own opener (ADR-0010). Never a child of a mark
or another row. A paragraph is a Row with no kind at all — its children are the plain text and
inline marks of the whole line.

## Properties

### children

```ts
readonly children: Signal<readonly TreeNode[]>;
```

Defined in: [core/src/features/tokens/tree/types.ts:104](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L104)

INLINE children first, then CHILD ROWS. ONE list, so every generic walk in `tree/`, `bind`
and `transactions` stays untouched by nesting; [inline](/api/interfaces/rownode/#inline) and [rows](/api/interfaces/rownode/#rows) are the two
named halves the caret mapping and the renderer need.

***

### descriptor

```ts
readonly descriptor: Signal<MarkupDescriptor | undefined>;
```

Defined in: [core/src/features/tokens/tree/types.ts:96](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L96)

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

Defined in: [core/src/features/tokens/tree/types.ts:87](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L87)

***

### kind

```ts
readonly kind: "row";
```

Defined in: [core/src/features/tokens/tree/types.ts:86](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L86)

***

### lead

```ts
readonly lead: Signal<string>;
```

Defined in: [core/src/features/tokens/tree/types.ts:125](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L125)

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

Defined in: [core/src/features/tokens/tree/types.ts:98](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L98)

The kind's metadata gap — a todo's checked flag, a fence's language.

***

### position

```ts
position: object;
```

Defined in: [core/src/features/tokens/tree/types.ts:130](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L130)

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

### addSibling()

```ts
addSibling(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:216](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L216)

Open a BLANK row after this row's whole subtree, at this row's own DEPTH — "add below", as a
verb rather than as a separator a caller splices.

The lead is the whole of what it carries, and it cannot be written outside this layer: which
side of the separator it goes on depends on whether this row's subtree ENDS THE DOCUMENT —
an ordinary row's span is already past its own separator, while the document-final row must
be terminated before the new line can follow it. `insertAfter(separator)` carried neither,
so a row added under a nested one landed at depth 0 and cut the list in two.

PAST THE SUBTREE, which is [splitAt](/api/interfaces/rownode/#splitat)'s placement rule and forced by the same encoding:
a row written between this one and its children, at this one's lead, adopts every one of
them. The KIND is deliberately not carried — "add a row" opens a blank one, and whether a
kind continues is Enter's question.

`false` for an editor with no separator, and for a dead row.

#### Returns

`boolean`

***

### duplicate()

```ts
duplicate(): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:219](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L219)

#### Returns

`boolean`

***

### inline()

```ts
inline(): readonly TreeNode[];
```

Defined in: [core/src/features/tokens/tree/types.ts:106](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L106)

The row's own inline content — Text and Mark nodes only, at least one text child.

#### Returns

readonly [`TreeNode`](/api/type-aliases/treenode/)[]

***

### insertAfter()

```ts
insertAfter(text): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:220](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L220)

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

Defined in: [core/src/features/tokens/tree/types.ts:135](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L135)

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

Defined in: [core/src/features/tokens/tree/types.ts:221](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L221)

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

Defined in: [core/src/features/tokens/tree/types.ts:239](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L239)

Move this row AND ITS SUBTREE to `placement`, keeping every row's identity — the moved
subtree's, its old siblings' and its new siblings'. The subtree is re-indented to sit under
its new parent, which NORMALIZES a surplus indent run exactly as [setDepth](/api/interfaces/rownode/#setdepth) does.

`false` for a placement inside the moved row's OWN subtree — a row cannot become its own
descendant — and for a dead row on either end, an index outside the destination's child
list, a no-op, an editor with no separator to rejoin rows by, and a nested placement in an
editor with nesting off.

And `false` for a placement the ENCODING cannot express, which is one answer with three
faces: nothing can be placed under an EMPTY row, a row carrying children cannot be re-led
into an empty one — a blank row is non-empty only while it carries an indent — and a move
cannot change where a row it never touched parses. The last is reachable only past a row
whose lead carries a surplus indent run some earlier paste left on it, and the move is
refused rather than allowed to rewrite that row.

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

Defined in: [core/src/features/tokens/tree/types.ts:114](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L114)

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

Defined in: [core/src/features/tokens/tree/types.ts:144](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L144)

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

Defined in: [core/src/features/tokens/tree/types.ts:218](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L218)

See NodeCommands.

#### Returns

`boolean`

***

### rows()

```ts
rows(): readonly RowNode[];
```

Defined in: [core/src/features/tokens/tree/types.ts:108](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L108)

The rows nested under this one.

#### Returns

readonly `RowNode`[]

***

### setDepth()

```ts
setDepth(depth): boolean;
```

Defined in: [core/src/features/tokens/tree/types.ts:161](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L161)

Re-indent this row to `depth`, rewriting its whole lead AND ITS SUBTREE'S — the descendants
travel with it, re-led by the same depth delta, because nesting is indentation and nothing
else and a child left at its old lead is measured against a parent that moved.

`false` for a no-op, for an editor with nesting off, and for a re-indent the SCAN would read
back as a different tree: a depth deeper than the row before it grants, a blank row outdented
to a root — which EMPTIES it, and an empty row takes no children — and a row after the subtree
that a raised ceiling would re-parent. The rows AFTER the subtree are not otherwise protected:
outdenting a row leaves the siblings following it at a depth its new depth now grants, so they
become its children, which is the encoding's answer rather than a choice.

It NORMALIZES a surplus indent run — see [lead](/api/interfaces/rownode/#lead): the bytes a paste preserved are lost
the first time a row or its ancestor is re-indented, which is the price of depth having one
reading.

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

Defined in: [core/src/features/tokens/tree/types.ts:142](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L142)

The interior's TEXT, joined from the live inline children.

#### Returns

`string`

***

### slotRange()

```ts
slotRange(): object;
```

Defined in: [core/src/features/tokens/tree/types.ts:140](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L140)

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

Defined in: [core/src/features/tokens/tree/types.ts:198](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L198)

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

Defined in: [core/src/features/tokens/tree/types.ts:181](https://github.com/Nowely/marked-input/blob/next/packages/core/src/features/tokens/tree/types.ts#L181)

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
