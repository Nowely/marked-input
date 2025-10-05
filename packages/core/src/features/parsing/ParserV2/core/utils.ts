import {MarkupDescriptor} from './MarkupDescriptor'
import {PatternMatch} from '../algorithms/PatternBuilder'
import {MatchSegment} from '../structures/PatternChainManager'

/**
 * Materializes gap values from text (lazy evaluation)
 * Converts undefined gap values to actual string content
 */
export function materializeGaps(match: PatternMatch, text: string): void {
	for (const part of match.parts) {
		if (part.type === 'gap' && part.value === undefined) {
			part.value = text.slice(part.start, part.end + 1)
		}
	}
}

/**
 * Extracts label and value from match parts based on gap types
 * Single pass through gaps for optimal performance
 */
export function extractContent(parts: MatchSegment[], descriptor: MarkupDescriptor): {label: string; value?: string} {
	let label = ''
	let value: string | undefined

	for (const part of parts) {
		if (part.type === 'gap') {
			if (part.gapType === 'label' && !label) {
				label = part.value || ''
			} else if (part.gapType === 'value') {
				value = part.value
			}
		}
	}

	return {label, value}
}

