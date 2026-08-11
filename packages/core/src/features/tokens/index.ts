// Canonical export point for the token layer: parsing, the live node model, and the DOM facade.

export type {Token, TextToken, MarkToken, Markup} from './parser/types'
export {annotate} from './parser/utils/annotate'
export {denote} from './parser/utils/denote'
export {TokenModel} from './seam/TokenModel'
// The addressing model is part of the token layer's cross-feature contract, not a tree
// internal: `TokenModel.anchorAt`/`replaceBetween` speak `NodeAnchor` in their signatures and
// `edit/`, `keyboard/`, `clipboard/` and `overlay/` type on it (plan decision, S1.6c task 8).
// `anchorEquals` joined them at S2.5, when "is this selection collapsed?" stopped being a
// numeric comparison for the four keyboard and overlay call sites above this layer.
export {anchorEquals} from './tree/anchors'
export type {Anchors, Id, MarkNode, MarkPatch, NodeAnchor, TextNode, TransactionResult, TreeNode} from './tree/types'
// The two halves of the selection (spec S2 D10): tree-space state here, DOM I/O below.
// Anchors-not-offsets and the pre-adoption capture are S1 D7. `SelectionController`
// composes the pair; `Store` still constructs it, which is why the deps of both are
// closures over `TokenModel`'s reads rather than the tree itself.
export {createSelection} from './tree/selection'
export type {Selection} from './tree/selection'
export type {TokenDelta} from './dom/commit'
export type {SelectionAnchor, SelectionSnapshot} from './dom/DomModel'
export {SelectionDriver} from './dom/SelectionDriver'
export {TokenHandle} from './dom/TokenHandle'