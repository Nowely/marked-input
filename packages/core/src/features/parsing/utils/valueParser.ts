import type {Store} from '../../../store/Store'
import type {Token} from '../parser/types'

export function getTokensByUI(store: Store): Token[] {
	const {focus} = store.nodes
	const parser = store.parsing.parser()
	const tokens = store.parsing.tokens()
	if (!parser) return tokens
	const parsed = parser.parse(focus.content)
	if (parsed.length <= 1) return tokens
	return tokens.toSpliced(focus.index, 1, ...parsed)
}

export function computeTokensFromValue(store: Store, value: string): Token[] {
	return parseWithParser(store, value)
}

export function parseUnionLabels(store: Store, ...indexes: number[]): Token[] {
	let span = ''
	const tokens = store.parsing.tokens()
	for (const index of indexes) {
		const token = tokens[index]
		span += token.content
	}

	return parseWithParser(store, span)
}

export function getRangeMap(store: Store): number[] {
	let position = 0
	const tokens = store.parsing.tokens()
	return tokens.map(token => {
		const length = token.content.length
		position += length
		return position - length
	})
}

export function parseWithParser(store: Store, value: string): Token[] {
	const parser = store.parsing.parser()
	if (!parser) {
		return [
			{
				type: 'text' as const,
				content: value,
				position: {start: 0, end: value.length},
			},
		]
	}

	return parser.parse(value)
}