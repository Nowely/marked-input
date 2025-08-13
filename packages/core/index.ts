export type {InnerOption} from './src/features/default/types'

export {assertAnnotated} from './src/utils/checkers/assertAnnotated'
export {assertNonNullable} from './src/utils/checkers/assertNonNullable'
export {annotate} from './src/utils/functions/annotate'
export {isAnnotated} from './src/utils/checkers/isAnnotated'

export {KEYBOARD, wordRegex} from './src/constants'
export type {label, value, MarkMatch, Markup, MarkStruct, OverlayMatch} from './src/types'

export {Parser} from './src/features/parsing/Parser/Parser'
export {denote} from './src/features/parsing/denote'
export {escape} from './src/utils/functions/escape'

export {PLACEHOLDER} from './src/constants'
export type {EventKey} from './src/types'
export type {Listener} from './src/types'
export {SystemEvent} from './src/constants'
export type {InnerMarkedInputProps} from './src/features/default/types'
export {Store} from './src/utils/classes/Store'
export {Caret} from './src/utils/classes/Caret'
export {TriggerFinder} from './src/utils/classes/TriggerFinder'
