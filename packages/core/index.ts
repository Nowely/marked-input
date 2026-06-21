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
export {MarkputHandler} from './src/store/MarkputHandler'

// Parsing exports (modern API)
export {annotate, denote} from './src/features/tokens'
export type {Markup, Token, TextToken, MarkToken} from './src/features/tokens'
export type {TokenPath, Range, MarkPatch, MarkInfo} from './src/shared/editorContracts'

// Reactive system
export type {Signal, Computed, Event, SignalValues} from './src/shared/signals'
export {effect, event, signal, computed, watch, batch, isReactive} from './src/shared/signals'

// Store
export {Store} from './src/store'
export type {MarkSlot, OverlaySlot} from './src/features/slots'

// Overlay
export {filterSuggestions, navigateSuggestions} from './src/features/overlay'

// Drag
export {getAlwaysShowHandle} from './src/features/block'

// Mark commands
export {MarkController} from './src/features/tokens'