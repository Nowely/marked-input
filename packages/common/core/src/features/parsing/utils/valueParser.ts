import type {Store} from '../../store/Store'
import type {Token} from '../ParserV2/types'
import {findGap, getClosestIndexes} from '../../preparsing'

export function getTokensByUI(store: Store): Token[] {
	const {focus} = store.nodes

	if (!store.state.parser) {
		return store.state.tokens
	}

	const tokens = store.state.parser.parse(focus.content)

	if (tokens.length === 1) return store.state.tokens

	return store.state.tokens.toSpliced(focus.index, 1, ...tokens)
}

export function getTokensByValue(store: Store): Token[] {
	const {
		props: {value},
	} = store
	const ranges = getRangeMap(store)
	const gap = findGap(store.state.previousValue, value)

	if (!gap.left && !gap.right) {
		store.state.previousValue = value
		return store.state.tokens
	}

	store.state.previousValue = value

	switch (true) {
		case gap.left !== undefined &&
			ranges.includes(gap.left) &&
			gap.right !== undefined &&
			Math.abs(gap.left - gap.right) > 1: {
			const updatedIndex = ranges.indexOf(gap.left)
			const tokens = parseUnionLabels(store, updatedIndex - 1, updatedIndex)
			return store.state.tokens.toSpliced(updatedIndex - 1, 2, ...tokens)
		}
		case gap.left !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.left)
			const tokens = parseUnionLabels(store, updatedIndex)
			if (tokens.length === 1) return store.state.tokens
			return store.state.tokens.toSpliced(updatedIndex, 1, ...tokens)
		}
		case gap.right !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.right)
			const tokens = parseUnionLabels(store, updatedIndex)
			if (tokens.length === 1) return store.state.tokens
			return store.state.tokens.toSpliced(updatedIndex, 1, ...tokens)
		}
		default:
			return parseWithParser(store, value ?? '')
	}
}

export function parseUnionLabels(store: Store, ...indexes: number[]): Token[] {
	let span = ''
	for (const index of indexes) {
		const token = store.state.tokens[index]
		span += token.content
	}

	return parseWithParser(store, span)
}

export function getRangeMap(store: Store): number[] {
	let position = 0
	return (
		store.state.tokens.map(token => {
			const length = token.content.length
			position += length
			return position - length
		}) ?? []
	)
}

export function parseWithParser(store: Store, value: string): Token[] {
	if (!store.state.parser) {
		return [
			{
				type: 'text' as const,
				content: value,
				position: {start: 0, end: value.length},
			},
		]
	}

	return store.state.parser.parse(value)
}
