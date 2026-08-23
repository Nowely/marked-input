# Block Feature

Manages the block editing mode where each row is rendered as a separate draggable block. Every row operation is a call on the row's own node.

## Components

- **BlockController**: THE Block layout owner, one per editor (`store.block`) — the hovered row, the dragged row, the drop edge and the open menu, each addressed by row ID. It attaches five listeners to the CONTAINER (mousemove, mouseleave, dragover, dragleave, drop) plus three geometry clocks — a `ResizeObserver` on the container, a watch on the commit clock, and a rAF loop over the painted rows while the controls are visible — owns the row verbs the menu triggers (`addRow`/`duplicateRow`/`deleteRow` call `insertAfter()`/`duplicate()`/`remove()` on the menu's row) and the drop handler that calls `moveTo()`, and answers the geometry the adapters paint at (`boxOf`, `rowAt`).
- **getAlwaysShowHandle**: Extracts `alwaysShowHandle` from `DraggableConfig`
- **BLOCK_MENU_ITEMS**: the menu's content contract — label, icon class and a verb taking the block controller.

## Why `Controller` and not `Model`

It owns state — five signals, the menu's element and the hover pin — so the suffix was contested. What decides it is DOM lifecycle taken at MOUNT, counted across core's whole population rather than argued, and the rule is ONE-WAY: taking it forces `Controller`, while not taking it forces nothing (`EditController` has no listeners, no signals and no mount hook). No `*Model` here takes a DOM listener on mount — `PropsModel`, `DomModel` and `TokenModel` call `listen` zero times, and `SuggestionsModel`'s one `container.addEventListener` sits in an opt-in `activate()` the adapter calls and takes back, not in a mount hook. `TokenModel` owns more state than anything else in core and pushed its DOM I/O out into a class deliberately not named `SelectionModel`. This one takes `host.onMounted`, installs five container listeners plus a `ResizeObserver`, a commit watch and a rAF loop there (and two document listeners while a menu is open), and its menu and drop verbs write the tree — the same job the per-row owner it replaced had. `OverlayController` is the precedent for a controller that owns its own state, and it is the shape this class copied for the menu's dismissal listeners.

`store.block` names its concern, not the class behind it (`store.tokens`, `store.edit`, `store.overlay`).

## One name, two designs

`git log` on `BlockController.ts` spans two of them, and the caveat is written here rather than left for a reader to trip over. The EARLIER `BlockController` vended a per-row `BlockStore` out of a `WeakMap` and pruned those stores by row id. The CURRENT one owns editor-level row-control state and there is no per-row store at all. The role is identical — the controller of Block layout — so the name is, but the internals share nothing. `BlockStore` and `blockIndex` are gone for good.

## Why the row controls are not per-row state

It used to be. The earlier controller vended a `BlockStore` per row node from a `WeakMap`, each holding five signals and wiring eight DOM handlers to its own row, and each adapter painted a side panel, two drop indicators and a menu INSIDE every row. At 200 rows that is 201 grip buttons, 201 `control()` roots and 1608 listeners; measured mount was 44 ms and 1005 DOM nodes, against 18 ms and 403 for one layer.

The row controls are also not document content, and mixing the two inside the editing host is what made every row need its own atomicity registrations. One layer is one control root, and everything painted in it inherits `isContentEditable === false` from it.

The price is geometry. `.Block { position: relative }` made a per-row grip and indicator free; a layer has to measure row rects itself, in CONTAINER-LOCAL coordinates (`rect.top − containerRect.top − container.clientTop + container.scrollTop`), which are scroll-proof by construction. Hit-testing a mousemove is a binary search over vertically tiled rows: 10 rect reads at 50 rows, 14 at 200, ~12 µs/tick steady and ~38 µs/tick when a DOM write between ticks forces each read to reflow. A measured box goes stale on any reflow, so the controller re-measures on three clocks — the container's own size; every commit, because a row that reflows moves every row BELOW it while the container's box does not change at all; and a rAF loop over the PAINTED rows while the controls are visible, for the reflow that is neither a commit nor a container resize. That last one is an image or a webfont landing inside a row ABOVE the painted one: it moves the painted row without changing its SIZE, so both observers stay silent and a mousemove inside the same row does not help either (hover re-measures only when the hovered ROW changes). Measured in both adapters, the grip sat 66px off its row and stayed there. The loop reads two rects per painted row per frame — 0.9 µs with a clean layout, 20 µs when every read forces a reflow — bumps the clock only when a box actually moved (0 DOM writes over 300ms of resting hover), and does not exist while the pointer is away. Observing every row would close the same hole at 201 ResizeObserver targets re-armed on every structural commit at N=200; a MutationObserver would not close it at all, since that reflow produces 0 mutation records. The pointer bound is also the loop's one gap, stated rather than glossed: `alwaysShowHandle` paints a grip with the pointer away, so a reflow that moves row 0 without resizing it drifts that grip and nothing repairs it until the pointer arrives (measured: `paddingTop: 60px` on an auto-height container moved the box 60px with the clock unchanged, and the container's content-box observer never fired). Pre-existing, and left open rather than paid for with frames for the editor's whole lifetime.

The grip band is anchored to its ROW (`left` from the measured box, `.SidePanel { margin-left: -24px }`) rather than to the layer's origin. Core reserves the 24px gutter only for draggable, editable block layout; anywhere else the layer's origin IS the row's left edge, and a band there covers the row's first 24px of text and swallows the click that should place a caret.

## Why the node verbs, and not a composed document

A composed document is diffed back to an edit window by `gapWindow`, a STRING diff — and a string diff cannot tell two byte-identical rows apart. `duplicate` and `add` manufacture exactly those (an added row is the separator string, the same bytes every time), so deleting the first of two identical rows retained the wrong node and announced the wrong id. Both adapters key rows by `node.id`, so the wrong id unmounted the wrong row.

Addressing the row's own node removes the ambiguity at the source: the splice window is the row's own span, and adoption's prefix/suffix walks keep every other row.

Reorder is the one operation that needed more than an anchor: a permutation is not derivable from the two strings, so the commit carries a `Pairing` stating it. That work also took the last `.position` read out of `block/`, which is why the directory is no longer on [ADR-0003](../../../../../docs/adr/0003-one-address-space.md)'s allowlist — the allowlist is gone.

## Addressing: the row id, everywhere

The menu holds the ID of the row it opened on and resolves it through `tokens.find` when a verb runs, so a row that has left the tree refuses instead of being written to. The drop resolves the same way: its source row is `state.dragging`, the id `beginDrag` wrote, and both it and the drop edge's row go through `rootIndexOf` on the live tree. It used to learn its source from the drag's own `text/plain` payload instead — see below.

The drop TARGET is geometric, like hover: `dragover` hit-tests the pointer's Y and snaps a point in the gutter or in the gap between two rows to the nearest row, where the per-row handler received no event there at all. The `drop` listener is on the container in EVERY layout, so it claims the event — `preventDefault` — only once it has a drop edge of its own to honour; cancelling a drop it refuses would suppress the browser's own editable drop.

## Provenance: what makes a drag ours

`state.dragging`, and nothing on the drag itself. Only `beginDrag` — the grip's own `dragstart` — sets it, and it is per-EDITOR, so `dragover` paints no drop edge for a drag this editor did not start and `drop` never claims one. Two editors on a page discriminate each other for free, the same way `captureMarkupPaste` keeps two editors from consuming each other's clipboard: with per-container state rather than an id in the payload.

The handler used to parse `text/plain` as a row index and refuse only `NaN`, with no provenance test at all. Dragging the bare text `0` in from another application reordered the document, and so did a second markput editor's row, whose payload was an equally bare index.

A private MIME type on the drag source is the other standard answer, and it was measured rather than argued: real Chromium 151 keeps a custom format in `dataTransfer.types` through `dragenter`, `dragover` and `drop`, where protected mode makes `getData` answer `''` for every format — so `types` alone can decide at `dragover`, and a format string is lowercased on the way in. It was rejected because telling editors apart needs an id minted for this one purpose and shipped through the DOM, which is a second copy of a fact this class already owns, and because that copy can be the wrong one: an editor remounted mid-drag still matches its own type while its tree, and every row index in flight, is new.

A foreign drop therefore FALLS THROUGH rather than being swallowed. Measured in real Chromium: an unprevented `dragover` still ends in `beforeinput`/`insertFromDrop` on a `contenteditable`, which is the event `replacementForInput` already turns into an insert — so text dragged in from anywhere lands in the row, in block layout exactly as in inline.

Because the drop no longer reads the payload, `text/plain` is free to carry what a drag OUT of the editor should deliver: the row's own text, the same thing `ClipboardController`'s copy puts there and the same thing the drag image shows.

## The hover pin

The hovered row FREEZES on the grip's own `mousedown`. This is not polish: between mousedown and Chromium's `dragstart` the pointer travels a few pixels, and an unpinned layer re-points the grip at whatever row that lands in — the grip walks out from under the pointer and no native drag event fires at all. Inside the row the problem could not exist, because the grip moved with its own row.

The pin attaches NOTHING to release itself. It is gesture state, so it expires with the gesture: the only reader is the container mouse handler, which clears it the first time it sees an event with no button held, and `endDrag()` covers the drag path (Chromium delivers no `mouseup` for a drag — the measured order is `pointerdown, mousedown, dragstart, pointercancel, drop, dragend`). A press that never becomes a drag and is released outside the editor therefore heals on re-entry; a container `mouseup` wedged the layer on the pressed row forever.

## Usage

The feature is registered by the Store and activates when block layout is enabled; `draggable` gates only the reorder path, because the menu and keyboard row edits are block-mode features rather than drag UI. Row operations run through `store.block`.
