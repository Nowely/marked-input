// Shared exports
export {cx, merge} from './src/shared/utils'
export {DEFAULT_OPTIONS} from './src/shared/constants'
export type {
	OverlayMatch,
	OverlayTrigger,
	CoreOption,
	MarkputHandler,
	StyleProperties,
	CoreSlots,
	CoreSlotProps,
	DataAttributes,
} from './src/shared/types'

// Parsing exports (modern API)
export {annotate, denote} from './src/features/parsing'
export type {Markup, Token, TextToken, MarkToken} from './src/features/parsing'

// Reactive system
export type {Signal, VoidEvent, PayloadEvent, UseHookFactory, StateObject} from './src/shared/signals'
export {
	setUseHookFactory,
	getUseHookFactory,
	effect,
	voidEvent,
	payloadEvent,
	defineState,
	watch,
} from './src/shared/signals'

// Store
export {Store, type Slot, type MarkSlot, type OverlaySlot} from './src/features/store'

// Overlay
export {createMarkFromOverlay, filterSuggestions, navigateSuggestions} from './src/features/overlay'

// Drag
export {getAlwaysShowHandleDrag} from './src/features/drag'

// Caret
export {Caret} from './src/features/caret'

// Mark Handler
export {MarkHandler, type MarkOptions, type RefAccessor} from './src/features/mark'