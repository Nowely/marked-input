import type {Store} from '../../store/Store'
import type {Token} from '../ParserV2/types'
import {findGap, getClosestIndexes} from '../../preparsing'

export function getTokensByUI(store: Store): Token[] {
	const {focus} = store.nodes
	const parser = store.state.parser()
	const tokens = store.state.tokens()

	if (!parser) {
		return tokens
	}

	const parsed = parser.parse(focus.content)

	if (parsed.length === 1) return tokens

	return tokens.toSpliced(focus.index, 1, ...parsed)
}

export function getTokensByValue(store: Store): Token[] {
	const value = store.state.value()
	const ranges = getRangeMap(store)
	const gap = findGap(store.state.previousValue(), value)

	if (!gap.left && !gap.right) {
		store.state.previousValue(value)
		return store.state.tokens()
	}

	store.state.previousValue(value)
	const tokens = store.state.tokens()

	switch (true) {
		case gap.left !== undefined &&
			ranges.includes(gap.left) &&
			gap.right !== undefined &&
			Math.abs(gap.left - gap.right) > 1: {
			const updatedIndex = ranges.indexOf(gap.left)
			const parsed = parseUnionLabels(store, updatedIndex - 1, updatedIndex)
			return tokens.toSpliced(updatedIndex - 1, 2, ...parsed)
		}
		case gap.left !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.left)
			const parsed = parseUnionLabels(store, updatedIndex)
			if (parsed.length === 1) return tokens
			return tokens.toSpliced(updatedIndex, 1, ...parsed)
		}
		case gap.right !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.right)
			const parsed = parseUnionLabels(store, updatedIndex)
			if (parsed.length === 1) return tokens
			return tokens.toSpliced(updatedIndex, 1, ...parsed)
		}
		default:
			return parseWithParser(store, value ?? '')
	}
}

export function parseUnionLabels(store: Store, ...indexes: number[]): Token[] {
	let span = ''
	const tokens = store.state.tokens()
	for (const index of indexes) {
		const token = tokens[index]
		span += token.content
	}

	return parseWithParser(store, span)
}

export function getRangeMap(store: Store): number[] {
	let position = 0
	const tokens = store.state.tokens()
	return (
		tokens.map(token => {
			const length = token.content.length
			position += length
			return position - length
		}) ?? []
	)
}

export function parseWithParser(store: Store, value: string): Token[] {
	const parser = store.state.parser()
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
