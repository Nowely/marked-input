# Markput

An editable text field that mixes plain text with inline custom components, declared through annotated markup patterns. One core runtime plus thin React and Vue adapters, so the language below holds across every package.

## Language

### The document

**Token**:
A unit of the document — text, a **Mark**, or a **Row**. Carries a stable identity that survives an
edit, and one element of its own that the adapter **consign**s (ADR-0009). Three kinds, not two: a
Row is a Token, which is why one registry, one commit and one anchor space cover all of them.
_Avoid_: node, element, item — `node` belongs to the DOM

**Tree**:
The arrangement the **Token**s are already in, not a second structure beside them: **Row**s nested
under Rows by their **Lead**, text and **Mark**s under a Row, further Tokens under a **Slot**. It is
the source of truth — a **Value** is its projection, and every write changes the tree first — which
is why `TreeNode` is published and `tokens.nodes()` hands back the roots. `features/tokens/tree/`
owns it; nothing outside walks it by hand.
_Avoid_: AST, model tree, node tree, document model, DOM (the DOM is the tree's painting, not the tree)

**Pairing**:
The claim that says which previous token each freshly parsed one continues. By default it is
position within the sibling list; an operation that knows better — a row move — states it, and
adoption honours it only where the parse agrees.
_Avoid_: mapping, matching, reconciliation, diff

**Mark**:
A token the consumer renders as their own component. Atomic to the caret unless it declares a slot.
_Avoid_: tag, chip, widget, entity, annotation

**Value**:
The whole document as one string, and the form value a consumer binds to. It is a projection of the tokens, not the other way round.
_Avoid_: text, content, document string

**Markup**:
The template string an option declares, carrying `__value__`, `__meta__` and/or `__slot__` placeholders. It is what a mark serialises to inside the value.
_Avoid_: pattern, template, syntax, format

**Option**:
One configured kind of mark: its markup, and how an overlay may be triggered for it.
_Avoid_: config, mark type, definition, plugin

**Slot**:
The region inside a mark that holds nested tokens and stays editable. A mark with no slot is atomic.
_Avoid_: children, body, inner content

**Meta**:
The secondary field a mark can carry beside its value — the `(…)` half of `@[name](id)`.
_Avoid_: data, payload, attributes, props

### Addressing

**Anchor**:
A position in the document, named relative to a token rather than as a number. Anchors are the only way to name a position outside `features/tokens/`, which owns the coordinate space; there are no longer any allowlisted exceptions, and the rule is checked by `packages/core/src/addressSpace.spec.ts` ([ADR-0003](docs/adr/0003-one-address-space.md)).
_Avoid_: offset, index, position, caret position, coordinate

**Caret**:
The insertion point inside the **Container** — the collapsed case of the browser's own selection,
and the one piece of state the editor reads OUT of the DOM rather than owning. Where a caret is, is
an **Anchor**; "caret" names the thing, never the number. It is applied on the DOM clock rather
than the commit clock, because a caret landing in a token born by this commit has no element until
`bind` gives it one. Structural bytes — a **Row**'s opener, its **Lead** — admit no caret at all.
_Avoid_: cursor, caret position (that is an **Anchor**), selection (a caret is its collapsed case), focus

### The runtime

**Store**:
The editor instance — one per mounted editor, holding every feature and every signal, and the only
door a consumer has to editor state. `useMarkput(selector)` selects from it in both adapters, so its
field names are public vocabulary: `store.tokens` (the **Tree** and the selection), `store.rows`,
`store.edit`, `store.overlay`, `store.history`. Each field names the CONCERN, not the things —
`store.rows` is the rows' own UI, while the rows themselves live in `tokens.nodes()`. The name is a
poor one for what it does and the class carries an open rename TODO (`store/Store.ts`); it is
published from `@markput/core`, so renaming it is a public change and not a tidy-up.
_Avoid_: state, context, global, singleton (one per editor, not one per app), editor (the editor is
the whole thing, of which this is the object)

### The editable surface

**Container**:
The single element the editor is mounted on, and the only `contenteditable` in the tree.
_Avoid_: host, editor element, root element, field

**Surface**:
The DOM text element a token's text is mirrored into. Exactly one writer per surface.
_Avoid_: span, text element, text node

**Host**:
The adapter seam. It owns the state the framework adapter feeds in — the container reference and the render lifecycle — and hands the container to features when one is attached.
_Avoid_: using it for the container element itself, or for the DOM spec's "editing host"

**Consign**:
The adapter's handover of a **Token**'s own element to the model — `tokens.consign(id)`, a ref
callback filed by owner id. It is THE element source: `bind` reads that registry and nothing else,
because the framework held the element a moment before it painted it, so the association is PUSHED
rather than re-discovered by a DOM walk. A **Surface** is the text case of the same handover.
_Avoid_: register, attach, mount, ref (the mechanism, not the act)

**Control**:
An element inside the **Container** that is editor UI rather than document content — the row-controls
layer, a consumer's checkbox, toggle arrow or `<select>` inside a **Row kind**. Announced by
`tokens.control()` (published as `useControlRef`), and registration is where it LEAVES the editing
host: without it the caret enters it and the browser edits it, so what a user types into a
checkbox's label lands in the **Value**. Element-level and singular; the plural "row controls",
lowercase, is the hover/drag/drop/menu layer beside the Rows, which is not a term.
_Avoid_: chrome (this repository reasons about Chromium on nearly every page), widget, UI element,
non-editable

### Overlays

**Overlay**:
The editor UI an **Option**'s `overlay` opens at the caret — a mention picker, a slash menu. ONE per
editor at a time, held as one match signal, opened by a TRIGGER character the option declares and
probed against the caret's own node; what it writes back is a `choose`, which both adapters hand out
unchanged. Both adapters paint it as a SIBLING of the **Container**, so it is outside the editing
host and needs no **Control** registration — unlike the **Row menu**'s other opener, the grip, whose
layer is inside the container and does register. An Overlay is positioned at the caret and is never
document content.
_Avoid_: popup, popover, dropdown, autocomplete, suggestions (that names the built-in component, not
the concept)

### Rows

**Row**:
The node the **Separator** carves out, holding the row's inline **Token**s and then its own child
Rows, in one list. Not simply "the text between two separators": a separator that falls inside a
**Row kind**'s raw body is that row's own text and no boundary at all, so one Row can read as
several visual lines and still carry one grip. A Row may have a **Row kind**,
whose opener and closing literal are structural bytes no caret may enter; a Row with no kind is a
**Paragraph**. The piece after the final separator is a Row even when empty (ADR-0009). Rows NEST by
**Lead**: a Row whose lead is deeper than the Row before it is that Row's child, at most one level
deeper (ADR-0010). A Row is also what a **Row kind**'s `split` carves that kind's own body into — a
**Cell** — and a carved Row's children are its body rather than rows of the document, so no
separator is written between them.
_Avoid_: line, block, item

**Paragraph**:
A **Row** with no **Row kind**. Named, not incidental: it is the one Row whose component is not its
kind's, so it is the only thing `slots.paragraph` answers, and `slotProps.row` reaches it like every
other Row.
_Avoid_: plain row, default row, text row

**Cell**:
A **Row** a **Row kind**'s `split` carved out of that kind's own body — a table cell. A Cell is a
Row and not a node kind of its own: its **Lead** is the delimiter it was split at, it renders through
its own option's component, and it holds ordinary inline marks. What separates it from a Row of the
document is that its parent's body IS the list it belongs to, so it takes no indent-nested children
and no **Separator** is written between Cells.
_Avoid_: column, field, table node

**Depth**:
A **Row**'s recursion index, counted from 0 — a root Row is at depth 0, its child at depth 1. It is
what the adapters pass down and what a Row kind's component receives as `depth`. It is the TREE, and
**Lead** is the bytes; there is no function from one to the other, because an over-indented paste
keeps its surplus in the lead and renders shallower.
_Avoid_: level, indent (as a term for the number), nesting count

**Lead**:
The structural bytes before a Row's own body — the run of **Indent** units it is nested by, or the
carve delimiter a **Cell** was split at. It is the ROUND-TRIP BYTES, not the **Depth**.
_Avoid_: indentation (as a term for the stored bytes), prefix, margin

**Indent**:
The editor-level string one nesting level is written with (`indent` prop, default `'\t'`), and
the only fact that decides whether a document nests at all — `''` turns nesting off, and with it
Row typing on any line that starts with it.
_Avoid_: tab, indentation unit, level

**Row kind**:
The **Markup** a Row is recognised by, matched ONLY at a row's own start and compiled by the same
compiler a **Mark**'s markup is (ADR-0010). Declared by an **Option**'s `row`, which also names
the component the Row renders through. A kind's body placeholder decides how its interior is
read: `__slot__` is inline-parsed, `__value__` is raw and never re-parsed, and a kind declaring
`split` carves that body at a literal into **Cell**s of the kind it names. A kind may carry no
markup at all when nothing but a `split` reaches it.
_Avoid_: block type, row type, node type

**Separator**:
The editor-level string that delimits **Row**s (`separator` prop, default `'\n'`), and the only
fact that decides whether a document has rows at all — `null` says it never splits, `''` is a bad
prop reported and treated as absent (ADR-0011). Structural: it belongs to no **Markup**, is that
markup's own text inside a Row kind's raw body, and bounds an open kind's body at the row's end
(ADR-0009, ADR-0010). It is not stored on a Row — the projection joins Rows with it, so only the
document-final Row lacks one.
_Avoid_: terminator; delimiter for THIS string — a **Row kind**'s `split` literal is "the carve
delimiter" and that is the one place the word is ours (both fine as prose)

### The row's own UI

**Row selection**:
The **Row**s the text selection covers WHOLE, maximal, in document order. DERIVED, never stored: a
row is selected exactly while the selection spans it, so Esc, Shift+arrows and Mod+A are each one
`select` call and the DOM paints it for free. A collapsed selection holds no Rows at all.
_Avoid_: selected blocks, block selection, multi-row mode

**Row menu**:
The menu a Row's own verbs are run from — add, duplicate, delete. One per editor, opened from the
grip or by the `/` **Option** the adapters ship, and addressed by the id of the Row it opened on, so
a Row that has left the tree refuses instead of being written to.
_Avoid_: block menu, context menu, slash menu (that names the trigger, not the menu)

### Value ownership

**Controlled**:
The state in which the consumer owns the value and passes it in on every render; the editor emits an intended value and waits for it to come back.
_Avoid_: managed, bound, external

**Uncontrolled**:
The state in which the editor owns the value, seeded once from a default. An edit lands immediately.
_Avoid_: internal, self-managed, local

**Edit record**:
One edit the document actually took: the two **Value**s it moved between, the splice that did it,
and where in the first the selection sat — as offsets, because a record outlives the nodes an
anchor would name. Recorded when the value MOVES, not when the edit is made — in
**Controlled** mode those are a round trip apart, and an emission the parent never echoes is not an
edit record at all ([ADR-0012](docs/adr/0012-the-editor-owns-undo.md)). Undo and redo are a record
replayed, backwards or forwards; the editor keeps no other history state.
_Avoid_: undo entry, transaction, change, patch, delta

## Relationships

- A **Value** is the projection of the **Token**s; every write changes tokens and the value follows
- A **Pairing** is how a **Token** keeps its identity across a write the value alone cannot explain
- An **Edit record** holds the **Pairing** its edit claimed, which is what an undo replays it by
- A **Mark** is a **Token**, and so is a **Row** — the node the **Separator** forms, nested under another Row by its **Lead**
- A **Row** with no **Row kind** is a **Paragraph**; a Row a kind's `split` carved out of its own body is a **Cell**
- An **Option** declares the **Markup** a **Mark** serialises to, or — with `row` — the **Row kind** it types a Row as
- A **Mark** may own a **Slot**, which holds further **Token**s
- A TEXT **Token** is mirrored into one **Surface**; a **Mark** and a **Row** own a consigned element instead — all of them inside the one **Container**
- An **Anchor** names a position by **Token**
- A **Caret** is a collapsed selection; where it sits is an **Anchor**
- The **Tree** is what the **Token**s are arranged into, and a **Store** is the one object that owns it
- A **Row selection** is read off the selection, and a **Row menu** runs one Row's verbs
- A **Control** sits inside the **Container** and outside the document; an **Overlay** sits outside the Container entirely — a **consign**ed element is neither

## Flagged ambiguities

- **"node" meant both the model unit and a DOM node.** Resolved: the model unit is a **Token**, and `node` is left to the DOM — the published `OverlayMatch.node` is a DOM `Node` (`shared/types.ts:75`), which is the collision the language is avoiding. `TreeNode`, `NodeAnchor`, `nodes()` and `nodeAt` keep the older word inside and around `tree/`; the names are not the language, and none of them is a rename target.
- **"token" meant both the parser's output and the runtime unit.** Resolved BY SCOPE: the runtime unit is a **Token**, and the parser's output is the parse's own intermediate — `parser/`'s `Token`/`TextToken`, which no consumer and no adapter touches. `MarkToken` is the exception and is not parser-local: it is a published export, because `denote`'s callback parameter is one and dropping the type made a shipped signature unnameable. Neither is a rename target — the second because the wider word is already on the public surface there. **Lexeme** was the second word this entry used to resolve it with, and it is DELETED, 2026-08-26: it had zero occurrences in any `.ts`/`.tsx`/`.vue` file in the repository, so it named the parse's output to nobody. A glossary word with no uptake is not vocabulary, it is a proposal; scope does the same work here without one.
- **"host" meant the element, the class owning it, and the DOM spec's concept.** Resolved: the element is the **Container**, the class is the **Host**. Where browser behaviour is under discussion, "editing host" is quoted as the spec's term, not used as ours.
- **"block" meant both a layout mode and the row it laid out.** Resolved by DELETION, 2026-08-26: there is no mode (ADR-0011), so the word names nothing here and the API no longer carries it. `slots.block` → `slots.paragraph` (the row with NO kind, which is the only thing it ever answered), `slotProps.block` → `slotProps.row` (every row's wrapper props — the two were never a pair), `BlockMenu` → `RowMenu`, `BLOCK_MENU_ITEMS` → `ROW_MENU_ITEMS`, `BlockController` → `RowController`, `store.block` → `store.rows`, `.Block` → `.Row`, `.BlockControls` → `.RowControls`. `isBlock` never existed as a declaration at all. `BlockStore` and `blockIndex` stay deleted, and the historical comments that name them stay too — a record is not a rename target. Where "block" still appears it is SOMEONE ELSE'S word and stays on purpose: CSS's (containing block, block box, `display: block`, `inline-block`), markdown's (code block, blockquote), and the Notion showcase's own product vocabulary (`.block`, `--notion-block-*`, `"Blocked"`), which the demo copies deliberately. The row controls get no glossary term — in prose they are "row controls", lowercase; the element-level word is **Control**, which now has one. The one leftover, the grip's `aria-label`, now reads "Row options": a behaviour change rather than a rename, taken deliberately, since the announced word was the last place the API still said "block".
- **"value" means both the whole document and a mark's own field.** Kept, not renamed: **Value** is the document, and a mark's field appears only in code form — the `__value__` placeholder and `MarkToken.value` — so the shape disambiguates. The document sense is unrenamable anyway; it is the published `value` prop. The two senses coincide today because a mark's field is the text it displays, and they pull apart the moment a field carries structure rather than display text — that is when this entry has to be revisited.
