// Shared exports
export {assertAnnotated} from './src/shared/checkers/assertAnnotated'
export {assertNonNullable} from './src/shared/checkers/assertNonNullable'
export {isAnnotated} from './src/features/parsing/ParserV1/utils/isAnnotated'
export {KEYBOARD} from './src/shared/constants'
export type {
	OverlayMatch,
	EventKey,
	Listener,
	OverlayTrigger,
} from './src/shared/types'

// Feature exports
export type {InnerOption, InnerMarkedInputProps} from './src/features/default'
export {DEFAULT_CLASS_NAME, DEFAULT_MARKUP, DEFAULT_OPTIONS, DEFAULT_TRIGGER} from './src/features/default'
export {Parser, annotate, escape, denote, getTokensByValue, getTokensByUI} from './src/features/parsing'
export {ParserV2} from './src/features/parsing/ParserV2'
export type {Markup as ParserMarkup, label, value, MarkMatch, MarkStruct, PieceType} from './src/features/parsing/ParserV1/types'
export type {Markup as ParserV2Markup} from './src/features/parsing/ParserV2'
export {findGap, getClosestIndexes} from './src/features/preparsing'
export {toString, shallow, createNewSpan, deleteMark} from './src/features/text-manipulation'
export {SystemEvent} from './src/features/events'
export {Store} from './src/features/store'
export {Caret, TriggerFinder} from './src/features/caret'
