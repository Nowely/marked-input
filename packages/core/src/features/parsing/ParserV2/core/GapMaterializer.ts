import {PatternMatch} from '../utils/PatternBuilder'

/**
 * Gap materializer responsible for lazy evaluation of gap values
 * Extracts actual text content for gaps in pattern matches
 */
export class GapMaterializer {
	/**
	 * Materializes gap values from text (lazy evaluation)
	 * Converts undefined gap values to actual string content
	 */
	materializeGaps(match: PatternMatch, text: string): void {
		for (const part of match.parts) {
			if (part.type === 'gap' && part.value === undefined) {
				part.value = text.slice(part.start, part.end + 1)
			}
		}
	}
}
