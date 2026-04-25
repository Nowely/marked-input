// oxlint-disable-next-line import/no-unassigned-import -- registers React slot module augmentation
import './src/augment'

export {MarkedInput} from './src/components/MarkedInput'
export {useMark} from './src/lib/hooks/useMark'
export {useMarkInfo} from './src/lib/hooks/useMarkInfo'
export {useOverlay} from './src/lib/hooks/useOverlay'
export {useMarkput} from './src/lib/hooks/useMarkput'

export type {MarkedInputProps} from './src/components/MarkedInput'
export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {Option, MarkProps, OverlayProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkController, MarkputHandler} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'