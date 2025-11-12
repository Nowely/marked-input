import type {Markup as ParserV2Markup} from '@markput/core'

/**
 * Converts ParserV1 markup format to ParserV2 markup format
 * 
 * @deprecated This converter is temporary for backward compatibility.
 * Will be removed in v2.0 when markput fully migrates to ParserV2 markup format.
 * 
 * Mapping:
 * - __label__ (ParserV1) → __value__ (ParserV2) - main content
 * - __value__ (ParserV1) → __meta__ (ParserV2) - metadata
 * 
 * Examples:
 * - "@[__label__]" → "@[__value__]"
 * - "@[__label__](__value__)" → "@[__value__](__meta__)"
 * - "#[__label__]" → "#[__value__]"
 */
export function convertMarkupV1ToV2(markup: string): ParserV2Markup {
	// Replace __label__ with __value__
	let converted = markup.replace(/__label__/g, '__value__')
	
	// Replace __value__ with __meta__ (but only the ones that were originally __value__)
	// We need to do this carefully to not replace the newly created __value__
	// Strategy: replace from right to left, or use a more sophisticated approach
	
	// Count occurrences of __value__ in the converted string
	const valueMatches = converted.match(/__value__/g)
	
	if (valueMatches && valueMatches.length === 2) {
		// If we have 2 occurrences, the second one should be __meta__
		// Find the second occurrence and replace it
		let firstIndex = converted.indexOf('__value__')
		let secondIndex = converted.indexOf('__value__', firstIndex + 1)
		
		if (secondIndex !== -1) {
			converted = 
				converted.substring(0, secondIndex) + 
				'__meta__' + 
				converted.substring(secondIndex + '__value__'.length)
		}
	}
	
	return converted as ParserV2Markup
}

