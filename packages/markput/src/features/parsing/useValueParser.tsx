import {useEffect, useRef} from 'react'
import {useListener} from '../../utils/hooks/useListener'
import {useStore} from '../../utils/hooks/useStore'
import {Parser, SystemEvent, findGap, getClosestIndexes} from '@markput/core'
import {Store} from '@markput/core'

export const useValueParser = () => {
	const store = useStore()
	const isMounted = useRef(false)
	const {value, options} = useStore(
		store => ({
			value: store.props.value,
			options: store.props.Mark ? store.props.options : undefined,
		}),
		true
	)

	useEffect(() => {
		// Update parser when options change
		const markups = options?.map(opt => opt.markup)
		if (markups && markups.length > 0) {
			store.parser = new Parser(markups)
		} else {
			store.parser = undefined
		}

		if (isMounted.current) {
			store.bus.send(SystemEvent.Parse)
			return
		}

		//Initial parse with ParserV2
		const inputValue = value ?? store.props.defaultValue ?? ''

		if (!store.parser) {
			store.tokens = [{
				type: 'text',
				content: inputValue,
				position: {start: 0, end: inputValue.length},
			}]
		} else {
			store.tokens = store.parser.parse(inputValue)
		}

		isMounted.current = true
	}, [value, options])

	useListener(
		SystemEvent.Parse,
		event => {
			store.tokens = store.focus.target ? getTokensByUI(store) : getTokensByValue(store)
		},
		[]
	)
}

// Inline getTokensByUI
function getTokensByUI(store: Store) {
	const {focus} = store

	if (!store.parser) {
		return store.tokens
	}

	const tokens = store.parser.parse(focus.content)

	if (tokens.length === 1) return store.tokens

	return store.tokens.toSpliced(focus.index, 1, ...tokens)
}

// Inline getTokensByValue
function getTokensByValue(store: Store) {
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
			return parseWithParser(store, value ?? '')
	}
}

function parseUnionLabels(store: Store, ...indexes: number[]) {
	let span = ''
	for (const index of indexes) {
		const token = store.tokens[index]
		span += token.content
	}

	return parseWithParser(store, span)
}

function getRangeMap(store: Store): number[] {
	let position = 0
	return (
		store.tokens.map(token => {
			const length = token.content.length
			position += length
			return position - length
		}) ?? []
	)
}

function parseWithParser(store: Store, value: string) {
	if (!store.parser) {
		return [{
			type: 'text' as const,
			content: value,
			position: {start: 0, end: value.length},
		}]
	}

	return store.parser.parse(value)
}
