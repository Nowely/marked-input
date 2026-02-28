// Shared exports
export {assertNonNullable} from './src/shared/checkers/assertNonNullable'
export {convertDataAttrs, cx, merge} from './src/shared/utils'
export {KEYBOARD, DEFAULT_MARKUP, DEFAULT_OVERLAY_TRIGGER} from './src/shared/constants'
export type {OverlayMatch, EventKey, Listener, OverlayTrigger, CoreOption, CoreMarkputProps} from './src/shared/types'

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
export {OverlayController} from './src/features/overlay'
export {FocusController} from './src/features/focus'
export {KeyDownController} from './src/features/input'
export {SystemListenerController} from './src/features/events'
export {TextSelectionController} from './src/features/selection'
export {Caret, TriggerFinder} from './src/features/caret'

// Feature Management
export {FeatureManager, asFeature, type Feature} from './src/features/FeatureManager'
export {createCoreFeatures} from './src/features/coreFeatures'

// Mark Handler
export {MarkHandler, type RefAccessor} from './src/features/mark'

// Navigation & Input
export {shiftFocusPrev, shiftFocusNext} from './src/features/navigation'
export {isFullSelection, selectAllText} from './src/features/selection'
export {handleBeforeInput, handlePaste, replaceAllContentWith} from './src/features/input'
