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
} from './src/shared/types'
export {MarkputHandler} from './src/shared/classes'

// Parsing exports (modern API)
export {annotate, denote} from './src/features/parsing'
export type {Markup, Token, TextToken, MarkToken} from './src/features/parsing'

// Reactive system
export type {Signal, Computed, Event} from './src/shared/signals'
export {effect, event, signal, computed, watch, batch} from './src/shared/signals'

// Store
export {Store} from './src/store'
export type {Slot, MarkSlot, OverlaySlot} from './src/features/slots'

// Overlay
export {createMarkFromOverlay, filterSuggestions, navigateSuggestions} from './src/features/overlay'

// Drag
export {getAlwaysShowHandleDrag} from './src/features/drag'

// Caret
export {Caret} from './src/features/caret'

// Mark Handler
export {MarkHandler, type MarkOptions, type RefAccessor} from './src/features/mark'