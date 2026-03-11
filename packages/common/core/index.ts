// Shared exports
export {assertNonNullable} from './src/shared/checkers/assertNonNullable'
export {
	convertDataAttrs,
	cx,
	merge,
	resolveOptionSlot,
	resolveSlot,
	resolveSlotProps,
	type SlotName,
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
export {Reactive} from './src/shared/classes/Reactive'
export {defineState, defineEvents} from './src/shared/classes'
export type {Signal, Emitter, UseHookFactory} from './src/shared/classes'

// Utilities
export {escape} from './src/shared/escape'
export {findGap, getClosestIndexes} from './src/features/preparsing'
export {toString} from './src/features/parsing'
export {shallow, createNewSpan, deleteMark} from './src/features/text-manipulation'
export {Store, type StoreOptions} from './src/features/store'
export {
	OverlayController,
	createMarkFromOverlay,
	filterSuggestions,
	navigateSuggestions,
	type NavigationAction,
	type NavigationResult,
} from './src/features/overlay'
export {FocusController} from './src/features/focus'
export {KeyDownController} from './src/features/input'
export {SystemListenerController} from './src/features/events'
export {TextSelectionController} from './src/features/selection'
export {ContentEditableController} from './src/features/editable'
export {Caret, TriggerFinder} from './src/features/caret'

// Feature Management
export {FeatureManager, asFeature, type Feature} from './src/features/FeatureManager'
export {createCoreFeatures} from './src/features/coreFeatures'

// Lifecycle
export {Lifecycle, type LifecycleOptions} from './src/features/lifecycle'

// Mark Handler
export {MarkHandler, type MarkOptions, type RefAccessor} from './src/features/mark'

// Blocks
export {
	splitTokensIntoBlocks,
	splitTokensIntoDragRows,
	reorderBlocks,
	reorderDragRows,
	addBlock,
	addDragRow,
	deleteBlock,
	deleteDragRow,
	duplicateBlock,
	duplicateDragRow,
	mergeDragRows,
	getMergeDragRowJoinPos,
	BLOCK_SEPARATOR,
	getAlwaysShowHandle,
	getAlwaysShowHandleDrag,
	type Block,
} from './src/features/blocks'

// Navigation & Input
export {shiftFocusPrev, shiftFocusNext} from './src/features/navigation'
export {isFullSelection, selectAllText} from './src/features/selection'
export {handleBeforeInput, handlePaste, replaceAllContentWith} from './src/features/input'