export {MarkedInput} from './src/components/MarkedInput'
export {createMarkedInput} from './src/utils/functions/createMarkedInput'
export {useMark} from './src/utils/hooks/useMark'
export {useOverlay} from './src/utils/hooks/useOverlay'
export {useListener} from './src/utils/hooks/useListener'

export type {MarkedInputProps, MarkedInputComponent} from './src/components/MarkedInput'
export type {MarkHandler} from './src/utils/hooks/useMark'
export type {OverlayHandler} from './src/utils/hooks/useOverlay'
export type {MarkedInputHandler, Option, ConfiguredMarkedInput} from './src/types'

export {denote, annotate} from '@markput/core'
export type {Markup, MarkMatch, MarkStruct, label, value} from '@markput/core'
