import {Token} from '../../parsing/ParserV2/types'
import {Parser} from '../../parsing/ParserV2'

/**
 * Converts Token[] array back to string representation using ParserV2
 */
export function toString(tokens: Token[]): string {
	return Parser.stringify(tokens)
}
