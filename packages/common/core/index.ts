// Shared exports
export {assertNonNullable} from './src/shared/checkers/assertNonNullable'
export {convertDataAttrs, mergeClassNames, mergeStyles} from './src/shared/utils'
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

// Utilities
export {escape} from './src/shared/escape'
export {findGap, getClosestIndexes} from './src/features/preparsing'
export {toString} from './src/features/parsing'
export {shallow, createNewSpan, deleteMark} from './src/features/text-manipulation'
export {SystemEvent} from './src/features/events'
export {Store} from './src/features/store'
export {Caret, TriggerFinder} from './src/features/caret'
