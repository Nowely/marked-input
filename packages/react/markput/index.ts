export {MarkedInput} from './src/components/MarkedInput'
export {Span} from './src/components/Span'
export {useMark} from './src/lib/hooks/useMark'
export {useOverlay} from './src/lib/hooks/useOverlay'

export type {MarkedInputProps} from './src/components/MarkedInput'
export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {Option, MarkProps, OverlayProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkHandler, MarkputHandler} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'