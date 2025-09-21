// Shared exports
export {assertAnnotated, assertNonNullable, isAnnotated} from './src/shared/checkers'
export {KEYBOARD, wordRegex, PLACEHOLDER} from './src/shared/constants'
export type {label, value, MarkMatch, Markup, MarkStruct, OverlayMatch, EventKey, Listener, OverlayTrigger} from './src/shared/types'

// Feature exports
export {DEFAULT_CLASS_NAME, DEFAULT_MARKUP, DEFAULT_OPTIONS, DEFAULT_TRIGGER, InnerOption, InnerMarkedInputProps} from './src/features/default'
export {Parser, annotate, escape, denote, getTokensByValue, getTokensByUI} from './src/features/parsing'
export {findGap, getClosestIndexes} from './src/features/preparsing'
export {toString, shallow, createNewSpan, deleteMark} from './src/features/text-manipulation'
export {SystemEvent} from './src/features/events'
export {Store} from './src/features/store'
export {Caret, TriggerFinder} from './src/features/caret'
