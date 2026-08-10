// Canonical export point for the token layer: parsing, the live node model, and the DOM facade.

export type {Token, TextToken, MarkToken, Markup} from './parser/types'
export {annotate} from './parser/utils/annotate'
export {denote} from './parser/utils/denote'
export {TokenModel} from './seam/TokenModel'
// The addressing model is part of the token layer's cross-feature contract, not a tree
// internal: `TokenModel.anchorAt`/`offsetOf` already speak `NodeAnchor` in their
// signatures, and `SelectionController` stores anchors and dedupes them on identity.
// Exported here rather than deep-imported from `tree/` (plan decision, S1.6c task 8).
export type {Id, MarkNode, MarkPatch, NodeAnchor, TextNode, TransactionResult, TreeNode} from './tree/types'
export {anchorEquals} from './tree/anchors'
// The tree-space selection state (spec D7): stored anchors, derived range, post-adoption
// repair. `SelectionController` composes it; `Store` still constructs the controller, so
// the deps arrive as closures over `TokenModel`'s reads (see `SelectionDeps`).
export {createSelection} from './tree/selection'
export type {Anchors, Selection, SelectionDeps} from './tree/selection'
export type {SelectionAnchor, SelectionSnapshot} from './dom/DomModel'
export {TokenHandle} from './dom/TokenHandle'