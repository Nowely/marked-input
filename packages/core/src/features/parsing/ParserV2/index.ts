export {ParserV2} from './ParserV2'
export {createSegmentMarkupDescriptor, type SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
export {AhoCorasickMarkupStrategy} from './AhoCorasickMarkupStrategy'
export type {NestedToken, TextToken, MarkToken, ParseContext, ValidationResult, BaseMarkupDescriptor} from './types'
export {
	validateNestedContent,
	validateTreeStructure,
	validateMarkup,
	countMarks,
	findMaxDepth
} from './validation'
