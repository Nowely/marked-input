# Markput

An editable text field that mixes plain text with inline custom components, declared through annotated markup patterns. One core runtime plus thin React and Vue adapters, so the language below holds across every package.

## Language

### The document

**Node**:
A unit of the document — either text or a mark. Carries a stable identity that survives an edit.
_Avoid_: token, element, item

**Mark**:
A node the consumer renders as their own component. Atomic to the caret unless it declares a slot.
_Avoid_: tag, chip, widget, entity, annotation

**Value**:
The whole document as one string, and the form value a consumer binds to. It is a projection of the nodes, not the other way round.
_Avoid_: text, content, document string

**Token**:
The parser's output shape, before it is folded into the node tree. A parser-local term — never the runtime unit.
_Avoid_: using it for anything a consumer or an adapter touches

**Markup**:
The template string an option declares, carrying `__value__`, `__meta__` and/or `__slot__` placeholders. It is what a mark serialises to inside the value.
_Avoid_: pattern, template, syntax, format

**Option**:
One configured kind of mark: its markup, and how an overlay may be triggered for it.
_Avoid_: config, mark type, definition, plugin

**Slot**:
The region inside a mark that holds nested nodes and stays editable. A mark with no slot is atomic.
_Avoid_: children, body, inner content

**Meta**:
The secondary field a mark can carry beside its value — the `(…)` half of `@[name](id)`.
_Avoid_: data, payload, attributes, props

### Addressing

**Anchor**:
A position in the document, named relative to a node rather than as a number. Anchors are the only way to name a position outside the tree layer.
_Avoid_: offset, index, position, caret position, coordinate

### The editable surface

**Container**:
The single element the editor is mounted on, and the only `contenteditable` in the tree.
_Avoid_: host, editor element, root element, field

**Surface**:
The DOM text element a node's text is mirrored into. Exactly one writer per surface.
_Avoid_: span, text element, text node

**Host**:
The adapter seam. It owns the state the framework adapter feeds in — the container reference and the render lifecycle — and hands the container to features when one is attached.
_Avoid_: using it for the container element itself, or for the DOM spec's "editing host"

### Layout

**Block layout**:
The mode in which every top-level node is its own row, draggable and reorderable. The alternative is inline layout, a single run of text.
_Avoid_: block mode, rows mode, list mode

**Row**:
A top-level node, when the editor is in block layout. Rows are nodes, not a separate structure.
_Avoid_: line, paragraph, block, item

### Value ownership

**Controlled**:
The state in which the consumer owns the value and passes it in on every render; the editor emits an intended value and waits for it to come back.
_Avoid_: managed, bound, external

**Uncontrolled**:
The state in which the editor owns the value, seeded once from a default. An edit lands immediately.
_Avoid_: internal, self-managed, local

## Relationships

- A **Value** is the projection of the **Node**s; every write changes nodes and the value follows
- A **Mark** is a **Node**; a **Row** is a top-level **Node** in **Block layout**
- An **Option** declares the **Markup** a **Mark** serialises to
- A **Mark** may own a **Slot**, which holds further **Node**s
- Every **Node** is mirrored into one **Surface**, all of them inside the one **Container**
- An **Anchor** names a position by **Node**

## Flagged ambiguities

- **"token" meant both the parser's output and the runtime unit.** Resolved: the runtime unit is a **Node**; **Token** is parser-local. `TokenModel`, `TokenHandle` and `features/tokens/` are named after the narrower term and predate the resolution — the names are not the language.
- **"host" meant the element, the class owning it, and the DOM spec's concept.** Resolved: the element is the **Container**, the class is the **Host**. Where browser behaviour is under discussion, "editing host" is quoted as the spec's term, not used as ours.
