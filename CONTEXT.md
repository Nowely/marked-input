# Markput

An editable text field that mixes plain text with inline custom components, declared through annotated markup patterns. One core runtime plus thin React and Vue adapters, so the language below holds across every package.

## Language

### The document

**Token**:
A unit of the document — either text or a mark. Carries a stable identity that survives an edit.
_Avoid_: node, element, item — `node` belongs to the DOM

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

**Lexeme**:
The parser's output shape, before it is folded into the token tree. A parser-local term — never the runtime unit.
_Avoid_: token, using it for anything a consumer or an adapter touches

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

### Layout

**Block layout**:
The shape a document takes when its **Separator** splits it: every top-level token is its own row, draggable and reorderable. Not a mode and not a prop — `separator: null` is the alternative, a single run of text with no rows at all (ADR-0011).
_Avoid_: block mode, rows mode, list mode

**Row**:
Block layout's node: a span of the document between **Separator** occurrences, holding the row's
inline **Token**s and then its own child Rows, in one list. A Row may have a **Row kind**, whose
opener and closing literal are structural bytes no caret may enter; a Row with no kind is a
paragraph. The piece after the final separator is a Row even when empty (ADR-0009). Rows NEST by
**Lead**: a Row whose lead is deeper than the Row before it is that Row's child, at most one level
deeper (ADR-0010).
_Avoid_: line, paragraph, block, item

**Lead**:
The structural bytes before a Row's own body — the run of **Indent** units it is nested by. It is
the ROUND-TRIP BYTES, not the depth: an over-indented paste keeps its surplus in the lead and
merely renders shallower, so there is no function from one to the other. Depth is the recursion
index the adapters pass down.
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
read: `__slot__` is inline-parsed, `__value__` is raw and never re-parsed.
_Avoid_: block type, row type, node type

**Separator**:
The editor-level string that delimits **Row**s (`separator` prop, default `'\n'`), and the only
fact that decides whether a document has rows at all — `null` says it never splits, `''` is a bad
prop reported and treated as absent (ADR-0011). Structural: it belongs to no **Markup**, is that
markup's own text inside a Row kind's raw body, and bounds an open kind's body at the row's end
(ADR-0009, ADR-0010). It is not stored on a Row — the projection joins Rows with it, so only the
document-final Row lacks one.
_Avoid_: terminator, delimiter (as a term; both fine as prose)

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
- A **Mark** is a **Token**; a **Row** is **Block layout**'s node, formed by the **Separator**, and nested under another Row by its **Lead**
- An **Option** declares the **Markup** a **Mark** serialises to, or — with `row` — the **Row kind** it types a Row as
- A **Mark** may own a **Slot**, which holds further **Token**s
- Every **Token** is mirrored into one **Surface**, all of them inside the one **Container**
- An **Anchor** names a position by **Token**

## Flagged ambiguities

- **"node" meant both the model unit and a DOM node.** Resolved: the model unit is a **Token**, and `node` is left to the DOM — the published `OverlayMatch.node` is a DOM `Node` (`shared/types.ts:75`), which is the collision the language is avoiding. `TreeNode`, `NodeAnchor`, `nodes()` and `nodeAt` keep the older word inside and around `tree/`; the names are not the language, and none of them is a rename target.
- **"token" meant both the parser's output and the runtime unit.** Resolved: the runtime unit is a **Token**, the parser's output is a **Lexeme**. `TextToken` and `MarkToken` in `parser/` still carry the wider word — parser-local names, not rename targets.
- **"host" meant the element, the class owning it, and the DOM spec's concept.** Resolved: the element is the **Container**, the class is the **Host**. Where browser behaviour is under discussion, "editing host" is quoted as the spec's term, not used as ours.
- **"block" meant both the layout and the row it lays out.** Resolved: the mode is **Block layout**, the unit is a **Row**. The API keeps the wider word by contract — `slots.block` and `slotProps.block` are the published names for the row wrapper, and `isBlock` follows them. The names are not the language; none of them is a rename target. `BlockController` is on this line too and STAYS — it is the one owner of Block layout, published as `store.block`, and it carries the row verbs `addRow`/`deleteRow`/`duplicateRow`, addressed by the open menu's Row. What is genuinely GONE, 2026-08-22, is `BlockStore` and `blockIndex`: per-row UI state was deleted outright, so the class that vended it went with it and the current `BlockController` shares only the name and the role. A Row is a Row, and nothing was renamed to reach that. The row controls themselves get no glossary term — in prose they are "row controls", lowercase, an ordinary phrase; the element-level word is `control` (`TokenModel.control()`), and "chrome" is not used at all, because this repository reasons about Chromium on nearly every page.
- **"value" means both the whole document and a mark's own field.** Kept, not renamed: **Value** is the document, and a mark's field appears only in code form — the `__value__` placeholder and `MarkToken.value` — so the shape disambiguates. The document sense is unrenamable anyway; it is the published `value` prop. The two senses coincide today because a mark's field is the text it displays, and they pull apart the moment a field carries structure rather than display text — that is when this entry has to be revisited.
