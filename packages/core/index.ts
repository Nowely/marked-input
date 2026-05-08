/**
 * @breaking b0: `CaretRecovery` type removed. Replace with `store.caret.range()`.
 *   `MarkputState.recovery` and `value.change` no longer exist — the single source
 *   of truth is `CaretModel.range` (a `Signal<RawRange | undefined>`) applied to
 *   the DOM by `DomController` after every render.
 *
 * @breaking b0: `Caret` static utility class removed. Migration paths:
 *   - `Caret.getCaretIndex(el)`, `setIndex(el, n)`, `setCaretToEnd(el)`,
 *     `trySetIndex(el, n)`, `setAtX(el, x, y)`, `getCaretRect()`,
 *     `isCaretOnFirstLine(el)`, `isCaretOnLastLine(el)` → import `caretDom`
 *     from '@markput/core' and call the equivalent function.
 *   - `Caret.getAbsolutePosition()` → use `store.overlay.position()`.
 *   - `Caret.getCurrentPosition()`, `getSelectedNode()`, `getFocusedSpan()`,
 *     `isSelectedPosition` → call `window.getSelection()` directly.
 *   - `Caret.getIndex`, `setIndex1`, `setCaretRightTo` → unused; no replacement.
 */

// Shared exports
export {cx, merge} from './src/shared/utils'
export {DEFAULT_OPTIONS} from './src/shared/constants'
export type {
	OverlayMatch,
	OverlayTrigger,
	CoreOption,
	CSSProperties,
	CoreSlots,
	CoreSlotProps,
	DataAttributes,
	DragAction,
	DragActions,
	DraggableConfig,
	Slot,
	SlotRegistry,
} from './src/shared/types'
export {MarkputHandler} from './src/shared/classes'

// Parsing exports (modern API)
export {annotate, denote, findToken} from './src/features/parsing'
export type {Markup, Token, TextToken, MarkToken} from './src/features/parsing'
export type {
	TokenPath,
	TokenAddress,
	Result,
	RawRange,
	RawSelection,
	MarkPatch,
	MarkSnapshot,
	MarkInfo,
} from './src/shared/editorContracts'

// Reactive system
export type {Signal, Computed, Event, SignalValues} from './src/shared/signals'
export {effect, event, signal, computed, watch, batch, isReactive, model} from './src/shared/signals'

// Store
export {Store} from './src/store'
export type {MarkSlot, OverlaySlot} from './src/features/slots'

// Overlay
export {createMarkFromOverlay, filterSuggestions, navigateSuggestions} from './src/features/overlay'

// Drag
export {getAlwaysShowHandle} from './src/features/drag'

// Caret DOM utilities
export {caretDom} from './src/features/caret'

// Mark commands
export {MarkController} from './src/features/mark'
export type {MarkOptions} from './src/features/mark'