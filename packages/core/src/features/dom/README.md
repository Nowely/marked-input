# DOM Index

Owns the token ↔ DOM mapping and the DOM-side state every other DOM-aware
feature reads from. The bridge module (`features/bridge/`) was replaced by this
feature in May 2026.

## Modules

- `TokenRefs` (`store.refs`) — ref-callback registries. Adapter components call
  `refs.control(path?)` and `refs.children(ownerPath)` to register DOM elements
  that should be treated as opaque controls or as nested child sequence hosts.
- `DomIndex` (`store.dom`) — owns indexing. Rebuilds on every `host.rendered()`
  using `buildIndex`. Exposes `locate(node)`, `nodeFor(address)`, `nodes()`,
  and the `indexed` event.
- `TextSurfaces` (`store.surfaces`) — owns text reconciliation. Reacts to the
  rendered DOM index, `props.readOnly`, and `setSelecting(active)` and uses
  `reconcileTextSurfaces` to write `textContent`, `contentEditable`, and `tabIndex`
  on text/mark surfaces.
- `buildIndex` — pure function. Walks tokens and DOM children in lockstep with
  one iterative stack frame per nesting level, skips control elements,
  optionally descends into a registered child-sequence host, and emits a
  `(byPath, byElement)` snapshot.
- `reconcileTextSurfaces` — pure function. Writes `textContent` /
  `contentEditable` on text token surfaces and `tabIndex` on mark roots from a
  given `{editable, readOnly}` flag pair.

## Ownership

- `TokenRefs` is the _only_ place ref callbacks live. Adapters never touch
  `DomIndex` directly.
- `DomIndex` is the _only_ place that walks the DOM to build the path → element
  index. `SelectionController`, keyboard handlers, and overlay all read through
  `dom.locate` / `dom.nodeFor` / `dom.nodes` rather than touching DOM children.
- `TextSurfaces` is the _only_ place that writes to `contentEditable`,
  `tabIndex`, and `textContent` of indexed nodes.

## Block layout indexing

`buildIndex` honours block layout when `isBlock` is true: each immediate child
of the container is treated as a row, and each row must contain exactly one
non-control element to count as a token surface. The alignment is
**all-or-nothing**: if any row has zero or more than one non-control element,
indexing for the whole frame bails. This matches the bridge's previous
behaviour for well-formed adapter output and fails loud when an adapter renders
something unexpected.

