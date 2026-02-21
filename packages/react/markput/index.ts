export {MarkedInput} from './src/components/MarkedInput'
export {useMark} from './src/lib/hooks/useMark'
export {useOverlay} from './src/lib/hooks/useOverlay'
export {useListener} from './src/lib/hooks/useListener'

export type {MarkedInputProps, MarkedInputComponent} from './src/components/MarkedInput'
export type {MarkHandler} from './src/lib/classes/MarkHandler'
export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {MarkedInputHandler, Option, MarkProps, OverlayProps} from './src/types'

// Re-export ParserV2 functions and types
export {denote, annotate} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'
