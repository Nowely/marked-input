export {ParserV2} from './ParserV2'
export {createSegmentMarkupDescriptor, type SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
export {AhoCorasickMarkupStrategy} from './AhoCorasickMarkupStrategy'
export {buildGuaranteedSequence} from './TokenSequenceBuilder'
export type {NestedToken, TextToken, MarkToken, ParseContext, ValidationResult, BaseMarkupDescriptor, TokenCandidate} from './types'
export {
	validateNestedContent,
	validateTreeStructure,
	validateMarkup,
	countMarks,
	findMaxDepth
} from './validation'
