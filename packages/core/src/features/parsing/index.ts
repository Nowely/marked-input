// Canonical export point for Parser APIs
// Public API for parsing and text manipulation

export {Parser} from './parser/Parser'
export type {Token, TextToken, MarkToken, Markup, ParseOptions} from './parser/types'
export {annotate} from './parser/utils/annotate'
export {denote} from './parser/utils/denote'
export {toString} from './parser/utils/toString'
export {findToken} from './utils/findToken'
export type {TokenContext} from './utils/findToken'
export {computeTokensFromValue, parseUnionLabels, getRangeMap, parseWithParser} from './utils/valueParser'
export {ParsingFeature, ParsingFeature as ParseFeature} from './ParseFeature'
export {createTokenIndex, pathEquals, pathKey, resolvePath, snapshotTokenShape, type TokenIndex} from './tokenIndex'