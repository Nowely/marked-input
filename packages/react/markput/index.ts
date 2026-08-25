// oxlint-disable-next-line import/no-unassigned-import -- registers React slot module augmentation
import './src/augment'

export {MarkedInput} from './src/components/MarkedInput'
export {useMark} from './src/lib/hooks/useMark'
export {useMarkInfo} from './src/lib/hooks/useMarkInfo'
export {useOverlay} from './src/lib/hooks/useOverlay'
export {useMarkput} from './src/lib/hooks/useMarkput'

export type {MarkedInputProps} from './src/components/MarkedInput'
export type {OverlayHandler} from './src/lib/hooks/useOverlay'
export type {Option, MarkProps, RowProps, OverlayProps, Slots, SlotProps} from './src/types'

// Re-export from core
export {denote, annotate, MarkputHandle} from '@markput/core'
// `changed` is an Event: the subscription verb is `watch`. Without this re-export the
// §2.3 event is documented but unreachable from the published packages.
export {watch} from '@markput/core'
// `MarkToken` rides along with `denote` above: it is that function's callback parameter, so
// without it a consumer of the PUBLISHED package cannot declare the callback separately.
// S2.8 dropped it with `Token`/`TextToken`; S2.9 restores this one, and only it.
export type {MarkToken, Markup} from '@markput/core'
export type {MarkNode, NodeAnchor, RowNode, TextNode, TreeNode} from '@markput/core'