export {MarkedInput} from './src/components/MarkedInput'
export {createMarkedInput} from './src/utils/functions/createMarkedInput'
export {useMark} from './src/utils/hooks/useMark'
export {useOverlay} from './src/utils/hooks/useOverlay'
export {useListener} from './src/utils/hooks/useListener'

export type {MarkedInputProps, MarkedInputComponent} from './src/components/MarkedInput'
export type {MarkHandler} from './src/utils/hooks/useMark'
export type {OverlayHandler} from './src/utils/hooks/useOverlay'
export type {MarkedInputHandler, Option, ConfiguredMarkedInput} from './src/types'

// Re-export ParserV2 functions as default (internally used)
// Note: markput uses ParserV2 internally but maintains ParserV1 MarkStruct format for backward compatibility
export {denote, annotate} from '@markput/core'

// Re-export ParserV1 functions for backward compatibility
/**
 * @deprecated Use denote from ParserV2 instead. Will be removed in v2.0
 */
export {denoteV1, annotateV1} from '@markput/core'

// Re-export ParserV2 types as primary types
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'

// Re-export ParserV1 types for backward compatibility
/**
 * @deprecated These types are from ParserV1 format. Will be removed in v2.0
 * Use Token types from ParserV2 instead
 */
export type {MarkMatch, MarkStruct, label, value, ParserV1Markup} from '@markput/core'
