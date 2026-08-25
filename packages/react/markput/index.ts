// oxlint-disable-next-line import/no-unassigned-import -- registers React slot module augmentation
import './src/augment'

export {MarkedInput} from './src/components/MarkedInput'
// The shipped ROW MENU. Core is framework-agnostic and ships no components, so the default
// slash-menu paint lives here beside `Suggestions`; `{overlay: {trigger: '/'}, Overlay: BlockMenu}`
// is the whole of a consumer's wiring.
export {BlockMenu} from './src/components/BlockMenu/BlockMenu'
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
// `Option.row`'s type. `@markput/core` already publishes it for the same reason; without it
// here the published package's own `Option` page links a name nothing exports, and `continues`
// is documented nowhere a consumer looks.
export type {RowSpec} from '@markput/core'
// `CoreOption.menu`'s type and what `useOverlay().entries` hands out: a consumer replacing
// `BlockMenu` declares both, and `Option` names the first in its own shape.
export type {MenuSpec, MenuEntry} from '@markput/core'
// `RowNode.moveTo`'s parameter, published for `RowSpec`'s reason: without it the built
// `.d.ts` names a type a consumer of this package cannot import.
export type {RowPlacement} from '@markput/core'