export {ParserV2} from './ParserV2'
export {ParserV2Matches} from './ParserV2Matches'
export {createMarkupDescriptor, type MarkupDescriptor} from './descriptor'
export type {NestedToken, TextToken, MarkToken, ParseContext, ValidationResult} from './types'
export {
	validateNestedContent,
	validateTreeStructure,
	validateMarkup,
	countMarks,
	findMaxDepth
} from './validation'
