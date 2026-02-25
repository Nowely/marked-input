export {MarkedInput} from './src/components/MarkedInput'
export {useMark} from './src/lib/hooks/useMark'
export {useOverlay} from './src/lib/hooks/useOverlay'
export {useListener} from './src/lib/hooks/useListener'

export type {MarkedInputProps} from './src/components/MarkedInput'
export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {MarkedInputHandler, Option, MarkProps, OverlayProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkHandler} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'
