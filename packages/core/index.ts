// Shared exports
export {assertNonNullable} from './src/shared/checkers/assertNonNullable'
export {KEYBOARD} from './src/shared/constants'
export type {OverlayMatch, EventKey, Listener, OverlayTrigger} from './src/shared/types'

// Feature exports
export type {CoreOption, CoreMarkputProps} from './src/features/default'
export {DEFAULT_CLASS_NAME, DEFAULT_MARKUP, DEFAULT_OPTIONS, DEFAULT_OVERLAY_TRIGGER} from './src/features/default'

// ParserV2 exports (modern API)
export {Parser, annotate, denote} from './src/features/parsing/ParserV2'
export type {Markup, Token, TextToken, MarkToken} from './src/features/parsing/ParserV2/types'

// Utilities
export {escape} from './src/shared/escape'
export {findGap, getClosestIndexes} from './src/features/preparsing'
export {toString, shallow, createNewSpan, deleteMark} from './src/features/text-manipulation'
export {SystemEvent} from './src/features/events'
export {Store} from './src/features/store'
export {Caret, TriggerFinder} from './src/features/caret'
