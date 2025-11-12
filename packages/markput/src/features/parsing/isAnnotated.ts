import {MarkMatch} from '@markput/core'

/**
 * Type guard to check if a value is an annotated mark (MarkMatch)
 * 
 * @deprecated This function is for backward compatibility with ParserV1 format.
 * Will be removed in v2.0 when markput fully migrates to ParserV2 Token[] format.
 * 
 * For ParserV2, use token.type === 'mark' instead.
 */
export const isAnnotated = (value: unknown): value is MarkMatch => {
	return value !== null && typeof value === 'object' && 'annotation' in value
}

