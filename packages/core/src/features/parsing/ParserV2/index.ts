export {ParserV2} from './ParserV2'
export {createMarkupDescriptor, type MarkupDescriptor} from './core/MarkupDescriptor'
export {MarkupMatcher} from './core/MarkupMatcher'
export {PatternEngine} from './core/PatternEngine'
export type {PatternMatch} from './utils/PatternBuilder'
export {PatternBuilder} from './utils/PatternBuilder'
export {SegmentMatcher} from './utils/SegmentMatcher'
export {PatternChainManager, type PatternChain, type MatchSegment} from './utils/PatternChainManager'
export {buildTokenSequence, createTextToken, extractInnerContent, createMarkToken} from './utils/TokenBuilder'
export type {NestedToken, TextToken, MarkToken, ParseContext, ValidationResult, BaseMarkupDescriptor} from './types'
export {
	validateNestedContent,
	validateTreeStructure,
	validateMarkup,
	countMarks,
	findMaxDepth
} from './utils/validation'
