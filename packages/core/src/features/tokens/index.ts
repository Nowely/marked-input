// Canonical export point for the token layer: parsing, the live node model, and the DOM facade.

export type {MarkToken, Markup, RowConfig} from './parser/types'
export {annotate} from './parser/utils/annotate'
// "Is this markup usable?" is a parser question, and it is asked from OUTSIDE the parser by
// every boundary that must not throw over a consumer's typo — `TokenModel.#parser` at the props
// seam, `OverlayController.choose` at the insertion seam. Both call `annotate`, and an `annotate`
// on a markup this rejects yields text no parser can read back.
export {markupError} from './parser/core/MarkupDescriptor'
export {denote} from './parser/utils/denote'
export {TokenModel} from './seam/TokenModel'
// The addressing model is part of the token layer's cross-feature contract, not a tree
// internal: `TokenModel.anchorAt`/`replaceBetween` speak `NodeAnchor` in their signatures and
// `edit/`, `keyboard/`, `clipboard/` and `overlay/` type on it (plan decision, S1.6c task 8).
// `anchorEquals` joined them at S2.5, when "is this selection collapsed?" stopped being a
// numeric comparison for the four keyboard and overlay call sites above this layer.
// `entryAnchor` joined them at P9, when Tab between a carved row's pieces made "the first position
// a caret may occupy in this row" a question the keyboard asks — and one whose answer is a rule
// (past a typed row's opener, recursively into a carved row's first piece), not a coordinate.
export {anchorEquals, entryAnchor} from './tree/anchors'
// Undo/redo's two halves, and neither is nameable without the other: `TokenModel.replay` takes a
// `Window`, and the one window it can be handed is an `EditRecord`'s read backwards.
export {gapWindow, invertWindow} from './tree/gapWindow'
// "Are this row's child rows its own carved BODY?" is a structural fact about a row that only the
// tree can answer, and the row hit test asks it: a cell has no line of its own, so the hit test stops
// at a carved row rather than descending into pieces no verb can address.
export {hasCells, hasRawBody} from './tree/rows'
// The repaint-field contract both adapters pass to `useMarkput` — core knowledge (which node
// fields reach a framework component), so it lives with the node model, not in an adapter.
export {renderSubscription} from './tree/renderSubscription'
export type {
	AnchoredRow,
	Anchors,
	EditRecord,
	MarkNode,
	NodeAnchor,
	Offsets,
	RowNode,
	RowPlacement,
	TextNode,
	TreeNode,
	Window,
} from './tree/types'
export {TokenHandle} from './dom/TokenHandle'