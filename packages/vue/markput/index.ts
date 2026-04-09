export {default as MarkedInput} from './src/components/MarkedInput.vue'
export {useMark} from './src/lib/hooks/useMark'
export {useOverlay} from './src/lib/hooks/useOverlay'

export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {MarkedInputProps, Option, MarkProps, OverlayProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkHandler, MarkputHandler} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'