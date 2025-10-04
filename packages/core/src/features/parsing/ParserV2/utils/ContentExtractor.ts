import {MatchResult} from '../types'
import {MarkupDescriptor} from '../core/MarkupDescriptor'
import {MatchSegment} from './PatternChainManager'

/**
 * Extracts label and value content from match results
 * Single Responsibility: content extraction logic
 */
export class ContentExtractor {
	/**
	 * Extracts label and value from match parts based on gap types
	 */
	extractFromParts(parts: MatchSegment[], descriptor: MarkupDescriptor): { label: string; value?: string } {
		const gaps = this.getGapParts(parts)

		if (descriptor.hasTwoLabels) {
			return this.extractTwoLabelPattern(gaps)
		} else if (descriptor.hasValue) {
			return this.extractValuePattern(gaps)
		} else {
			return this.extractSimplePattern(gaps)
		}
	}

	/**
	 * Extracts label and value from a match result
	 * Used as fallback for compatibility
	 */
	extractContent(match: MatchResult): { label: string; value?: string } {
		const descriptor = match.descriptor as MarkupDescriptor

		// Simple extraction from match result
		return {
			label: match.label,
			value: match.value
		}
	}

	private getGapParts(parts: MatchSegment[]): MatchSegment[] {
		return parts.filter(p => p.type === 'gap')
	}

	private extractTwoLabelPattern(gaps: MatchSegment[]): { label: string; value?: string } {
		const labelGap = gaps.find(g => g.gapType === 'label')
		const valueGap = gaps.find(g => g.gapType === 'value')

		return {
			label: labelGap?.value || '',
			value: valueGap?.value
		}
	}

	private extractValuePattern(gaps: MatchSegment[]): { label: string; value?: string } {
		const labelGap = gaps.find(g => g.gapType === 'label')
		const valueGap = gaps.find(g => g.gapType === 'value')

		return {
			label: labelGap?.value || '',
			value: valueGap?.value
		}
	}

	private extractSimplePattern(gaps: MatchSegment[]): { label: string; value?: string } {
		const labelGap = gaps.find(g => g.gapType === 'label')
		return {
			label: labelGap?.value || ''
		}
	}
}
