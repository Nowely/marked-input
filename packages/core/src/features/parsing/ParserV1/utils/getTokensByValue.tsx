import {findGap} from '../../../preparsing/utils/findGap'
import {getClosestIndexes} from '../../../preparsing/utils/getClosestIndexes'
import {Store} from '../../../store'
import {Parser} from '../Parser'
import {isAnnotated} from './isAnnotated'

export function getTokensByValue(store: Store) {
	const {
		props: {value, options},
	} = store
	const ranges = getRangeMap(store)
	const gap = findGap(store.previousValue, value)
	store.previousValue = value

	switch (true) {
		//Mark removing happen
		case gap.left && ranges.includes(gap.left) && gap.right && Math.abs(gap.left - gap.right) > 1: {
			const updatedIndex = ranges.indexOf(gap.left)
			const tokens = parseUnionLabels(store, updatedIndex - 1, updatedIndex) as any
			return store.tokens.toSpliced(updatedIndex - 1, 2, ...tokens)
		}
		//Changing in label
		case gap.left !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.left)
			const tokens = parseUnionLabels(store, updatedIndex) as any
			if (tokens.length === 1) return store.tokens
			return store.tokens.toSpliced(updatedIndex, 1, ...tokens)
		}
		case gap.right !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.right)
			const tokens = parseUnionLabels(store, updatedIndex) as any
			if (tokens.length === 1) return store.tokens
			return store.tokens.toSpliced(updatedIndex, 1, ...tokens)
		}
		default:
			//Parse all string
			return Parser.split(value ?? '', options) as any
	}
}

type ParseType = '' | 'all'

function identifyParseType(store: Store) {
	switch (true) {
	}
}

function parseUnionLabels(store: Store, ...indexes: number[]) {
	let span = ''
	for (const index of indexes) {
		const token = store.tokens[index]
		// Support both old MarkStruct and new Token formats
		span += (token as any).label || (token.type === 'text' ? token.content : token.type === 'mark' ? token.value : '')
	}

	return Parser.split(span, store.props.options)
}

function getRangeMap(store: Store): number[] {
	let position = 0
	return (
		store.tokens.map(token => {
			// Support both old MarkStruct and new Token formats
			const length = token.type === 'mark' 
				? token.content.length 
				: token.type === 'text' 
					? token.content.length 
					: (token as any).annotation?.length || (token as any).label?.length || 0
			position += length
			return position - length
		}) ?? []
	)
}
