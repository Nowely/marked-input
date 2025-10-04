export {ParserV2} from './ParserV2'
export {createMarkupDescriptor, type MarkupDescriptor} from './MarkupDescriptor'
export {MarkupMatchingStrategy} from './MarkupMatcher'
export {PatternEngine} from './PatternEngine'
export type {PatternMatch} from './PatternBuilder'
export {PatternBuilder} from './PatternBuilder'
export {SegmentMatcher} from './SegmentMatcher'
export {PatternChainManager, type PatternChain, type MatchSegment} from './PatternChainManager'
export {buildTokenSequence, createTextToken, extractInnerContent, createMarkToken} from './TokenBuilder'
export type {NestedToken, TextToken, MarkToken, ParseContext, ValidationResult, BaseMarkupDescriptor} from './types'
export {
	validateNestedContent,
	validateTreeStructure,
	validateMarkup,
	countMarks,
	findMaxDepth
} from './validation'
