import {Parser as ParserV2} from '@markput/core'
import {Store} from '@markput/core'
import {adaptTokensToMarkStruct} from './adapter'
import {convertMarkupV1ToV2} from './markupConverter'

/**
 * Parse current focused token (UI-driven updates)
 * 
 * @deprecated This function uses ParserV1 MarkStruct format for backward compatibility.
 * Will be removed in v2.0 when markput fully migrates to ParserV2 Token[] format.
 */
export function getTokensByUI(store: Store) {
	const {focus, props} = store
	const options = store.props.Mark ? store.props.options : undefined
	const tokens = parseWithAdapter(focus.content, options)

	if (tokens.length === 1) return store.tokens

	return store.tokens.toSpliced(focus.index, 1, ...tokens)
}

/**
 * Parse with ParserV2 and adapt to MarkStruct[] format
 */
function parseWithAdapter(value: string, options: any[] | undefined) {
	// Convert ParserV1 markups to ParserV2 format
	const markupsV2 = options?.map(opt => convertMarkupV1ToV2(opt.markup))
	
	if (!markupsV2 || markupsV2.length === 0) {
		return [{label: value}]
	}
	
	const parser = new ParserV2(markupsV2)
	const tokens = parser.parse(value)
	return adaptTokensToMarkStruct(tokens)
}

