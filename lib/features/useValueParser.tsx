import {useEffect} from 'react'
import {Option} from '../types'
import {isAnnotated} from '../utils/checkers/isAnnotated'
import {Parser} from '../utils/classes/Parser/Parser'
import {Store} from '../utils/classes/Store'
import {findGap} from '../utils/functions/findGap'
import {getClosestIndexes} from '../utils/functions/getClosestIndexes'
import {useStore} from '../utils/hooks/useStore'

export const useValueParser = () => {
	const store = useStore()
	const {value, options} = useStore(store => ({
		value: store.props.value,
		options: store.props.Mark ? store.props.options : undefined,
	}), true)

	useEffect(() => {
		/*if (store.focus.target)
			updateStateFromUI(store, options)
		else {*/
		updateStateFromValue(store, value, options)
		//}
	}, [value, options])
}


function updateStateFromUI(store: Store, options?: Option[]) {
	const {focus} = store
	const tokens = Parser.split(focus.content, options)

	if (tokens.length === 1) return

	store.tokens = store.tokens.toSpliced(focus.index, 1, ...tokens)
}


function updateStateFromValue(store: Store, value: string, options?: Option[]) {
	const ranges = getRangeMap(store)
	const gap = findGap(store.previousValue, value)
	store.previousValue = value

	switch (true) {
		//Mark removing happen
		case gap.left && (ranges.includes(gap.left) && gap.right && Math.abs(gap.left - gap.right) > 1):
			const updatedIndex1 = ranges.indexOf(gap.left)
			const tokens1 = parseUnionedLabels(store, updatedIndex1 - 1, updatedIndex1)
			store.tokens = store.tokens.toSpliced(updatedIndex1, 1, ...tokens1)
			break
		//Changing in label
		case gap.left !== undefined:
			const [updatedIndex] = getClosestIndexes(ranges, gap.left)
			const tokens2 = parseUnionedLabels(store, updatedIndex)
			if (tokens2.length === 1) return
			store.tokens = store.tokens.toSpliced(updatedIndex, 1, ...tokens2)
			break
		default:
			//Parse all string
			store.tokens = Parser.split(value, options)
	}
}

function parseUnionedLabels(store: Store, ...indexes: number[]) {
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
