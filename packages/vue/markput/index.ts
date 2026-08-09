// oxlint-disable-next-line import/no-unassigned-import -- registers Vue slot module augmentation
import './src/augment'

export {default as MarkedInput} from './src/components/MarkedInput.vue'
export {useMark} from './src/lib/hooks/useMark'
export {useMarkInfo} from './src/lib/hooks/useMarkInfo'
export {useOverlay} from './src/lib/hooks/useOverlay'
export {useMarkput} from './src/lib/hooks/useMarkput'

export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {MarkedInputProps, Option, MarkProps, OverlayProps, Slots, SlotProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkputApi} from '@markput/core'
// `changed` is an Event: the subscription verb is `watch`. Without this re-export the
// §2.3 event is documented but unreachable from the published packages.
export {watch} from '@markput/core'
export type {Markup, Token, TextToken, MarkToken} from '@markput/core'