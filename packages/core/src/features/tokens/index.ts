// Canonical export point for the token layer: parsing, the live node model, and the DOM facade.

export type {Token, TextToken, MarkToken, Markup} from './parser/types'
export {annotate} from './parser/utils/annotate'
export {denote} from './parser/utils/denote'
export {TokenModel} from './model/TokenModel'
export type {SelectionAnchor, SelectionSnapshot} from './DomModel'
export {TokenHandle} from './model/TokenHandle'
export {MarkController} from './MarkController'