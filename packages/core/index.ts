// Shared exports
export {assertAnnotated, assertNonNullable, isAnnotated} from './src/shared/checkers'
export {KEYBOARD, wordRegex} from './src/shared/constants'
export type {
	label,
	value,
	MarkMatch,
	MarkStruct,
	OverlayMatch,
	EventKey,
	Listener,
	OverlayTrigger,
} from './src/shared/types'

// Feature exports
export type {InnerOption, InnerMarkedInputProps} from './src/features/default'
export {DEFAULT_CLASS_NAME, DEFAULT_MARKUP, DEFAULT_OPTIONS, DEFAULT_TRIGGER} from './src/features/default'
export {Parser, ParserV2, annotate, escape, denote, getTokensByValue, getTokensByUI} from './src/features/parsing'
export type {Markup as ParserMarkup} from './src/features/parsing/Parser'
export type {Markup as ParserV2Markup} from './src/features/parsing/ParserV2'
export {findGap, getClosestIndexes} from './src/features/preparsing'
export {toString, shallow, createNewSpan, deleteMark} from './src/features/text-manipulation'
export {SystemEvent} from './src/features/events'
export {Store} from './src/features/store'
export {Caret, TriggerFinder} from './src/features/caret'
