import type {Store} from '../../../store/Store'
import type {Token} from '../parser/types'
import {findGap, getClosestIndexes} from '../preparsing'

export function getTokensByUI(store: Store): Token[] {
	const {focus} = store.nodes
	const parser = store.parsing.parser()
	const tokens = store.parsing.tokens()
	if (!parser) return tokens
	const parsed = parser.parse(focus.content)
	if (parsed.length <= 1) return tokens
	return tokens.toSpliced(focus.index, 1, ...parsed)
}

export function computeTokensFromValue(store: Store): Token[] {
	const value = store.props.value()
	const previousValue = store.value.previousValue()
	const gap = findGap(previousValue, value)

	if (!gap.left && !gap.right) {
		store.value.previousValue(value)
		return store.parsing.tokens()
	}

	if (gap.left === 0 && previousValue !== undefined && gap.right !== undefined && gap.right >= previousValue.length) {
		store.value.previousValue(value)
		return parseWithParser(store, value ?? '')
	}

	store.value.previousValue(value)
	const ranges = getRangeMap(store)
	const tokens = store.parsing.tokens()

	if (
		gap.left !== undefined &&
		ranges.includes(gap.left) &&
		gap.right !== undefined &&
		Math.abs(gap.left - gap.right) > 1
	) {
		const updatedIndex = ranges.indexOf(gap.left)
		if (updatedIndex > 0) {
			const parsed = parseUnionLabels(store, updatedIndex - 1, updatedIndex)
			return tokens.toSpliced(updatedIndex - 1, 2, ...parsed)
		}
	}
	if (gap.left !== undefined) {
		const [updatedIndex] = getClosestIndexes(ranges, gap.left)
		const parsed = parseUnionLabels(store, updatedIndex)
		if (parsed.length === 1) return tokens
		return tokens.toSpliced(updatedIndex, 1, ...parsed)
	}
	if (gap.right !== undefined) {
		const [updatedIndex] = getClosestIndexes(ranges, gap.right)
		const parsed = parseUnionLabels(store, updatedIndex)
		if (parsed.length === 1) return tokens
		return tokens.toSpliced(updatedIndex, 1, ...parsed)
	}
	return parseWithParser(store, value ?? '')
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