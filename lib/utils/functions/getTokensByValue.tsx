import {Store} from '../classes/Store'
import {Option} from '../../types'
import {findGap} from './findGap'
import {getClosestIndexes} from './getClosestIndexes'
import {Parser} from '../classes/Parser/Parser'
import {isAnnotated} from '../checkers/isAnnotated'

export function getTokensByValue(store: Store) {
	const {props: {value, options}} = store
	const ranges = getRangeMap(store)
	const gap = findGap(store.previousValue, value)
	store.previousValue = value

	switch (true) {
		//Mark removing happen
		case gap.left && (ranges.includes(gap.left) && gap.right && Math.abs(gap.left - gap.right) > 1):
			const updatedIndex1 = ranges.indexOf(gap.left)
			const tokens1 = parseUnionLabels(store, updatedIndex1 - 1, updatedIndex1)
			return store.tokens.toSpliced(updatedIndex1, 1, ...tokens1)
		//Changing in label
		case gap.left !== undefined:
			const [updatedIndex] = getClosestIndexes(ranges, gap.left)
			const tokens2 = parseUnionLabels(store, updatedIndex)
			if (tokens2.length === 1) return store.tokens
			return store.tokens.toSpliced(updatedIndex, 1, ...tokens2)
		default:
			//Parse all string
			return Parser.split(value, options)
	}
}

function parseUnionLabels(store: Store, ...indexes: number[]) {
	let span = ''
	for (const index of indexes) {
		span += store.tokens[index].label
	}

	return Parser.split(span, store.props.options)
}

function getRangeMap(store: Store): number[] {
	let position = 0
	return store.tokens.map(token => {
		const length = isAnnotated(token) ? token.annotation.length : token.label.length
		position += length
		return position - length
	}) ?? []
}