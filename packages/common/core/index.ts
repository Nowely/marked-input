// Shared exports
export {
	convertDataAttrs,
	cx,
	merge,
	resolveOptionSlot,
	resolveSlot,
	resolveSlotProps,
	getDirectChildIndex,
	isClickOutside,
	isEscapeKey,
} from './src/shared/utils'
export {
	KEYBOARD,
	DEFAULT_MARKUP,
	DEFAULT_OVERLAY_TRIGGER,
	DEFAULT_OPTIONS,
	type DefaultOption,
	type DefaultOverlayConfig,
} from './src/shared/constants'
export type {
	OverlayMatch,
	EventKey,
	Listener,
	OverlayTrigger,
	CoreOption,
	MarkputState,
	MarkputHandler,
	StyleProperties,
	GenericComponent,
	GenericElement,
	GenericAttributes,
	CoreSlots,
	CoreSlotProps,
	DataAttributes,
} from './src/shared/types'

// Parsing exports (modern API)
export {
	Parser,
	annotate,
	denote,
	findToken,
	getTokensByUI,
	getTokensByValue,
	parseUnionLabels,
	getRangeMap,
	parseWithParser,
} from './src/features/parsing'
export type {Markup, Token, TextToken, MarkToken, TokenContext} from './src/features/parsing'

// Reactive system
export type {Signal, UseHookFactory} from './src/shared/classes'

// Utilities
export {escape} from './src/shared/escape'
export {findGap, getClosestIndexes} from './src/features/parsing/preparsing'
export {toString} from './src/features/parsing'
export {shallow, createNewSpan, deleteMark} from './src/features/editing'
export {Store} from './src/features/store'
export {OverlayController, createMarkFromOverlay, filterSuggestions, navigateSuggestions} from './src/features/overlay'

// Drag
export {
	DragController,
	getDragDropPosition,
	parseDragSourceIndex,
	getDragTargetIndex,
	filterDragTokens,
	EMPTY_TEXT_TOKEN,
	getAlwaysShowHandleDrag,
} from './src/features/drag'
export {Caret, TriggerFinder} from './src/features/caret'

// Feature Management
export {FeatureManager, asFeature, type Feature, createCoreFeatures} from './src/features/feature-manager'

// Lifecycle
export {Lifecycle, type LifecycleOptions} from './src/features/lifecycle'

// Mark Handler
export {MarkHandler, type MarkOptions, type RefAccessor} from './src/features/mark'

// Navigation & Input
export {shiftFocusPrev, shiftFocusNext} from './src/features/navigation'
export {isFullSelection, selectAllText} from './src/features/selection'
export {handleBeforeInput, handlePaste, replaceAllContentWith} from './src/features/input'