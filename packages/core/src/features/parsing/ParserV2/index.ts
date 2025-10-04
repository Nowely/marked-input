export {ParserV2} from './ParserV2'
export {createMarkupDescriptor, type MarkupDescriptor} from './createMarkupDescriptor'
export {createSegmentMarkupDescriptor, type SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
export {AhoCorasickMarkupStrategy} from './AhoCorasickMarkupStrategy'
export type {NestedToken, TextToken, MarkToken, ParseContext, ValidationResult, BaseMarkupDescriptor, MarkupStrategy} from './types'
export {
	validateNestedContent,
	validateTreeStructure,
	validateMarkup,
	countMarks,
	findMaxDepth
} from './validation'
