import {Token, MarkToken} from '@markput/core'
import {MarkStruct} from '@markput/core'

/**
 * Adapter to convert ParserV2 Token[] format to legacy ParserV1 MarkStruct[] format
 * 
 * @deprecated This adapter is temporary for backward compatibility.
 * Will be removed in v2.0 when markput fully migrates to ParserV2 Token[] format.
 * 
 * Mapping:
 * - ParserV2 TextToken → {label: string}
 * - ParserV2 MarkToken → {label: string, value?: string, annotation: string, optionIndex: number}
 * - ParserV2 value → ParserV1 label (main content)
 * - ParserV2 meta → ParserV1 value (metadata)
 * 
 * Note: Nested tokens are flattened since ParserV1 doesn't support nesting.
 */
export function adaptTokensToMarkStruct(tokens: Token[]): MarkStruct[] {
	const result: MarkStruct[] = []
	
	for (const token of tokens) {
		if (token.type === 'text') {
			// TextToken → {label: string}
			// Always add text tokens, even if empty (needed for empty input)
			result.push({label: token.content})
		} else {
			// MarkToken → flatten and convert
			flattenMarkToken(token, result)
		}
	}
	
	// Ensure at least one token exists (for empty input)
	if (result.length === 0) {
		result.push({label: ''})
	}
	
	return result
}

/**
 * Flattens a MarkToken and its children into MarkStruct[] format
 * Since ParserV1 doesn't support nesting, we flatten the structure
 */
function flattenMarkToken(token: MarkToken, result: MarkStruct[]): void {
	// For ParserV1 compatibility:
	// - token.value (ParserV2) → label (ParserV1)
	// - token.meta (ParserV2) → value (ParserV1)
	// - token.content → annotation
	// - token.descriptor.index → optionIndex
	
	const markStruct: any = {
		label: token.value,
		annotation: token.content,
		optionIndex: token.descriptor.index,
		input: token.content,
		index: token.position.start,
	}
	
	// Add value field if meta exists
	if (token.meta !== undefined) {
		markStruct.value = token.meta
	}
	
	result.push(markStruct)
	
	// If there are nested children, flatten them recursively
	// This is a limitation of ParserV1 - nested structures are not supported
	if (token.children.length > 0) {
		for (const child of token.children) {
			if (child.type === 'text') {
				if (child.content.length > 0) {
					result.push({label: child.content})
				}
			} else {
				flattenMarkToken(child, result)
			}
		}
	}
}

