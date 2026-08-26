// oxlint-disable-next-line import/no-unassigned-import -- registers React slot module augmentation
import './src/augment'

export {MarkedInput} from './src/components/MarkedInput'
// The shipped ROW MENU. Core is framework-agnostic and ships no components, so the default
// slash-menu paint lives here beside `Suggestions`; `{overlay: {trigger: '/'}, Overlay: BlockMenu}`
// is the whole of a consumer's wiring.
export {BlockMenu} from './src/components/BlockMenu/BlockMenu'
// What a consumer's own control — a toggle arrow, a checkbox, a `<select>` — takes so the
// caret and the browser's own editing stay out of it. `TokenModel.control()` is the SPI behind
// it, and reaching for that means reaching through `store.tokens`.
export {useControlRef} from './src/lib/hooks/useControlRef'
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
// `overlay.data`'s element type. A consumer declaring the rows the built-in picker offers has to
// name it, and the built `.d.ts` already does through `Option` — published for `MenuEntry`'s
// reason, and because without it a page wiring an `@` picker reaches past the adapter into core
// for a type alone.
export type {Suggestion} from '@markput/core'
// `useOverlay().choose`'s parameter, published for `RowPlacement`'s reason: the built
// `.d.ts` names it, so a consumer wrapping `choose` must be able to import it.
export type {OverlayPick} from '@markput/core'
// `RowNode.moveTo`'s parameter, published for `RowSpec`'s reason: without it the built
// `.d.ts` names a type a consumer of this package cannot import.
export type {RowPlacement} from '@markput/core'