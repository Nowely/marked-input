import {TextToken} from '../types'

/**
 * Creates a text token for a range in the input
 *
 * @param input - Original input text
 * @param start - Start position (inclusive)
 * @param end - End position (exclusive)
 * @returns TextToken with extracted content and position
 */
export const createTextToken = (input: string, start = 0, end = input.length): TextToken => {
	return {
		type: 'text',
		content: input.substring(start, end),
		position: {start, end},
	}
}
