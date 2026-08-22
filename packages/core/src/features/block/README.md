# Block Feature

Manages the block editing mode where each row is rendered as a separate draggable block. Every row operation is a call on the row's own node.

## Components

- **BlockController**: Vends each row's `BlockStore` via `store.block.get(node)`, lazily created and cached in a `WeakMap` keyed by the row NODE — adoption writes surviving nodes in place and allocates an id only at `buildNode`, so within one input "kept its id" and "kept its object" are the same statement, and the object key self-collects instead of needing a prune.
- **BlockStore**: Per-row UI state (drag/hover/menu signals), DOM wiring (`attachContainer`/`attachGrip`/`attachMenu`), and the row verbs the chrome triggers — `addBlock`/`deleteBlock`/`duplicateBlock` call `insertAfter()`/`remove()`/`duplicate()` on the row it holds, and the container's `drop` handler calls `moveTo()`. One instance per row node, constructed by the controller with that node, `PropsModel` and `TokenModel`, so the adapters attach bare elements and thread no index.
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`

## Why the node verbs, and not a composed document

A composed document is diffed back to an edit window by `gapWindow`, a STRING diff — and a string diff cannot tell two byte-identical rows apart. `duplicate` and `add` manufacture exactly those (an added row is the separator string, the same bytes every time), so deleting the first of two identical rows retained the wrong node and announced the wrong id. Both adapters key rows by `node.id` and this feature keys per-row state by the row's identity, so the wrong id unmounted the wrong row.

Addressing the row's own node removes the ambiguity at the source: the splice window is the row's own span, and adoption's prefix/suffix walks keep every other row.

Reorder is the one operation that needed more than an anchor: a permutation is not derivable from the two strings, so the commit carries a `Pairing` stating it. That work also took the last `.position` read out of `block/`, which is why the directory is no longer on [ADR-0003](../../../../../docs/adr/0003-one-address-space.md)'s allowlist — the allowlist is gone.

## Addressing: the node, except on the drop

A `BlockStore` holds its row node, so the three menu verbs need no index at all. The container's `drop` handler is the exception: it learns its source from the drag's own `text/plain` payload, so it resolves that INDEX through `tokens.nodes()`. The payload carries no provenance, so the index is not trusted — a negative one is refused rather than handed to `Array.prototype.at`, which wraps and would address the LAST row.

## Usage

The feature is registered by the Store and activates when block layout is enabled; `draggable` gates only the reorder path, because the menu and keyboard row edits are block-mode features rather than drag UI. Row operations run through `store.block.get(node)`.
