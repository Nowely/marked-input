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
The mode in which every top-level token is its own row, draggable and reorderable. The alternative is inline layout, a single run of text.
_Avoid_: block mode, rows mode, list mode

**Row**:
A top-level token, when the editor is in block layout. Rows are tokens, not a separate structure.
_Avoid_: line, paragraph, block, item

### Value ownership

**Controlled**:
The state in which the consumer owns the value and passes it in on every render; the editor emits an intended value and waits for it to come back.
_Avoid_: managed, bound, external

**Uncontrolled**:
The state in which the editor owns the value, seeded once from a default. An edit lands immediately.
_Avoid_: internal, self-managed, local

## Relationships

- A **Value** is the projection of the **Token**s; every write changes tokens and the value follows
- A **Pairing** is how a **Token** keeps its identity across a write the value alone cannot explain
- A **Mark** is a **Token**; a **Row** is a top-level **Token** in **Block layout**
- An **Option** declares the **Markup** a **Mark** serialises to
- A **Mark** may own a **Slot**, which holds further **Token**s
- Every **Token** is mirrored into one **Surface**, all of them inside the one **Container**
- An **Anchor** names a position by **Token**

## Flagged ambiguities

- **"node" meant both the model unit and a DOM node.** Resolved: the model unit is a **Token**, and `node` is left to the DOM — the published `OverlayMatch.node` is a DOM `Node` (`shared/types.ts:75`), which is the collision the language is avoiding. `TreeNode`, `NodeAnchor`, `nodes()` and `nodeAt` keep the older word inside and around `tree/`; the names are not the language, and none of them is a rename target.
- **"token" meant both the parser's output and the runtime unit.** Resolved: the runtime unit is a **Token**, the parser's output is a **Lexeme**. `TextToken` and `MarkToken` in `parser/` still carry the wider word — parser-local names, not rename targets.
- **"host" meant the element, the class owning it, and the DOM spec's concept.** Resolved: the element is the **Container**, the class is the **Host**. Where browser behaviour is under discussion, "editing host" is quoted as the spec's term, not used as ours.
- **"block" meant both the layout and the row it lays out.** Resolved: the mode is **Block layout**, the unit is a **Row**. The API keeps the wider word by contract — `slots.block` and `slotProps.block` are the published names for the row wrapper, and `BlockStore`, `BlockController`, `blockIndex` and `isBlock` follow them. The names are not the language; none of them is a rename target.
