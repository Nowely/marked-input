// oxlint-disable-next-line import/no-unassigned-import -- registers React slot module augmentation
import './src/augment'

export {MarkedInput} from './src/components/MarkedInput'
// `useControlRef` on one wrapper, and the second of the two shapes a control takes: the hook marks
// a single control, this marks a whole interior that is not document surface. Every consumer that
// paints an atomic row kind wrote it by hand, and the failure it removes was measured — four of
// the showcase's seven atomic kinds shipped with no control root at all.
export {Atomic} from './src/components/Atomic'
// THE shipped overlay list, and the DEFAULT one: core is framework-agnostic and ships no
// components, so the paint lives here. It is exported for a consumer who wants it beside a
// custom overlay on another option — wiring a row menu needs no component at all, since
// `{overlay: {trigger: '/'}}` already resolves to this.
export {OverlayList} from './src/components/OverlayList/OverlayList'
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
// `useMarkput`'s selector PARAMETER — the one type every consumer of that hook receives on its
// first line and could not name without adding `@markput/core` as a second dependency. TYPE only:
// core exports the class because both adapters construct one, and building an editor by hand is
// not a contract this package offers.
//
// `MarkInfo` rides with it for `MarkToken`'s reason: it is `useMarkInfo()`'s RETURN, so a consumer
// declaring that value separately had the same second dependency. The generated page for the hook
// already names both types and links neither.
export type {MarkInfo, Store} from '@markput/core'
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
// `CoreOption.menu`'s type and what `useOverlay().rows` hands out: a consumer replacing
// `OverlayList` declares both, and `Option` names the first in its own shape.
export type {MenuSpec, OverlayRow} from '@markput/core'
// `overlay.data`'s element type. A consumer declaring the rows the built-in picker offers has to
// name it, and the built `.d.ts` already does through `Option` — published for `OverlayRow`'s
// reason, and because without it a page wiring an `@` picker reaches past the adapter into core
// for a type alone.
export type {Suggestion} from '@markput/core'
// `useOverlay().choose`'s parameter, published for `RowPlacement`'s reason: the built
// `.d.ts` names it, so a consumer wrapping `choose` must be able to import it.
export type {OverlayPick} from '@markput/core'
// `RowNode.moveTo`'s parameter, published for `RowSpec`'s reason: without it the built
// `.d.ts` names a type a consumer of this package cannot import.
export type {RowPlacement} from '@markput/core'