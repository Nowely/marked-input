// Shared exports
export {assertAnnotated} from './src/shared/checkers/assertAnnotated'
export {assertNonNullable} from './src/shared/checkers/assertNonNullable'
export {KEYBOARD} from './src/shared/constants'
export type {OverlayMatch, EventKey, Listener, OverlayTrigger} from './src/shared/types'

// Feature exports
export type {InnerOption, InnerMarkedInputProps} from './src/features/default'
export {DEFAULT_CLASS_NAME, DEFAULT_MARKUP, DEFAULT_OPTIONS, DEFAULT_TRIGGER} from './src/features/default'

// ParserV2 as default (modern API)
export {Parser, annotate, denote} from './src/features/parsing/ParserV2'
export type {Markup, Token, TextToken, MarkToken} from './src/features/parsing/ParserV2/types'

// ParserV1 exports (deprecated, for backward compatibility)
/**
 * @deprecated Use Parser from ParserV2 instead. Will be removed in v2.0
 */
export {Parser as ParserV1} from './src/features/parsing/ParserV1'
/**
 * @deprecated Use annotate from ParserV2 instead. Will be removed in v2.0
 */
export {annotate as annotateV1} from './src/features/parsing/ParserV1/utils/annotate'
/**
 * @deprecated Use denote from ParserV2 instead. Will be removed in v2.0
 */
export {denote as denoteV1} from './src/features/parsing/ParserV1/utils/denote'
/**
 * @deprecated Use token type checking instead. Will be removed in v2.0
 */
export {isAnnotated} from './src/features/parsing/ParserV1/utils/isAnnotated'
/**
 * @deprecated These utilities are ParserV1-specific. Will be removed in v2.0
 */
export {getTokensByValue, getTokensByUI} from './src/features/parsing'

// ParserV1 types (deprecated, for backward compatibility)
export type {
	Markup as ParserV1Markup,
	label,
	value,
	MarkMatch,
	MarkStruct,
	PieceType,
} from './src/features/parsing/ParserV1/types'

export {escape} from './src/shared/escape'
export {findGap, getClosestIndexes} from './src/features/preparsing'
export {toString, shallow, createNewSpan, deleteMark} from './src/features/text-manipulation'
export {SystemEvent} from './src/features/events'
export {Store} from './src/features/store'
export {Caret, TriggerFinder} from './src/features/caret'
