export {ParserV2} from './ParserV2'
export {createSegmentMarkupDescriptor, type SegmentMarkupDescriptor} from './SegmentMarkupDescriptor'
export {AhoCorasickStrategy} from './AhoCorasickStrategy'
export {PatternEngine, type PatternMatch} from './PatternEngine'
export {PatternChainManager, type PatternChain, type MatchSegment} from './PatternChainManager'
export {buildGuaranteedSequence} from './TokenAssembler'
export type {NestedToken, TextToken, MarkToken, ParseContext, ValidationResult, BaseMarkupDescriptor} from './types'
export {
	validateNestedContent,
	validateTreeStructure,
	validateMarkup,
	countMarks,
	findMaxDepth
} from './validation'
