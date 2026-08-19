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
export {denote, annotate, MarkputHandle} from '@markput/core'
// `changed` is an Event: the subscription verb is `watch`. Without this re-export the
// §2.3 event is documented but unreachable from the published packages.
export {watch} from '@markput/core'
// `MarkToken` rides along with `denote` above: it is that function's callback parameter, so
// without it a consumer of the PUBLISHED package cannot declare the callback separately.
// S2.8 dropped it with `Token`/`TextToken`; S2.9 restores this one, and only it.
export type {MarkToken, Markup} from '@markput/core'
export type {Id, MarkNode, MarkPatch, NodeAnchor, TextNode, TreeNode} from '@markput/core'