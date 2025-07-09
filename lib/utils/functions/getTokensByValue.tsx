import {DEFAULT_OPTIONS} from '../../features/default/constants'
import {isAnnotated} from '../checkers/isAnnotated'
import {Parser} from '../classes/Parser/Parser'
import {Store} from '../classes/Store'
import {findGap} from './findGap'
import {getClosestIndexes} from './getClosestIndexes'

export function getTokensByValue(store: Store) {
	const {props: {value, options}} = store
	const ranges = getRangeMap(store)
	const gap = findGap(store.previousValue, value)
	store.previousValue = value

	switch (true) {
		//Mark removing happen
		case gap.left && (ranges.includes(gap.left) && gap.right && Math.abs(gap.left - gap.right) > 1): {
			const updatedIndex = ranges.indexOf(gap.left)
			const tokens = parseUnionLabels(store, updatedIndex - 1, updatedIndex)
			return store.tokens.toSpliced(updatedIndex - 1, 2, ...tokens)
		}
		//Changing in label
		case gap.left !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.left)
			const tokens = parseUnionLabels(store, updatedIndex)
			if (tokens.length === 1) return store.tokens
			return store.tokens.toSpliced(updatedIndex, 1, ...tokens)
		}
		case gap.right !== undefined: {
			const [updatedIndex] = getClosestIndexes(ranges, gap.right)
			const tokens = parseUnionLabels(store, updatedIndex)
			if (tokens.length === 1) return store.tokens
			return store.tokens.toSpliced(updatedIndex, 1, ...tokens)
		}
		default:
			//Parse all string
			//TODO temp hack
			const optionsWithDefault = options?.map((option) => Object.assign({}, DEFAULT_OPTIONS[0], option))
			return Parser.split(value ?? '', optionsWithDefault)
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
		span += store.tokens[index].label
	}

	//TODO temp hack
	const optionsWithDefault = store.props.options?.map((option) => Object.assign({}, DEFAULT_OPTIONS[0], option))
	return Parser.split(span, optionsWithDefault)
}

function getRangeMap(store: Store): number[] {
	let position = 0
	return store.tokens.map(token => {
		const length = isAnnotated(token) ? token.annotation.length : token.label.length
		position += length
		return position - length
	}) ?? []
}