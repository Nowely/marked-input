// Canonical export point for the token layer: parsing, the live node model, and the DOM facade.

export type {MarkToken, Markup} from './parser/types'
export {annotate} from './parser/utils/annotate'
export {denote} from './parser/utils/denote'
export {TokenModel} from './seam/TokenModel'
// The addressing model is part of the token layer's cross-feature contract, not a tree
// internal: `TokenModel.anchorAt`/`replaceBetween` speak `NodeAnchor` in their signatures and
// `edit/`, `keyboard/`, `clipboard/` and `overlay/` type on it (plan decision, S1.6c task 8).
// `anchorEquals` joined them at S2.5, when "is this selection collapsed?" stopped being a
// numeric comparison for the four keyboard and overlay call sites above this layer.
export {anchorEquals} from './tree/anchors'
// The repaint-field contract both adapters pass to `useMarkput` — core knowledge (which node
// fields reach a framework component), so it lives with the node model, not in an adapter.
export {renderSubscription} from './tree/renderSubscription'
export type {Anchors, MarkNode, NodeAnchor, TextNode, TreeNode} from './tree/types'
export {TokenHandle} from './dom/TokenHandle'