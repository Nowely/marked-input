import {findGap, getClosestIndexes} from '@markput/core'
import {Store} from '@markput/core'
import {Parser as ParserV2} from '@markput/core'
import {adaptTokensToMarkStruct} from './adapter'
import {isAnnotated} from './isAnnotated'
import {convertMarkupV1ToV2} from './markupConverter'

/**
 * Parse tokens based on value changes (external updates)
 * 
 * @deprecated This function uses ParserV1 MarkStruct format for backward compatibility.
 * Will be removed in v2.0 when markput fully migrates to ParserV2 Token[] format.
 */
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
			return parseWithAdapter(value ?? '', options)
	}
}

function parseUnionLabels(store: Store, ...indexes: number[]) {
	let span = ''
	for (const index of indexes) {
		span += store.tokens[index].label
	}

	return parseWithAdapter(span, store.props.options)
}

function getRangeMap(store: Store): number[] {
	let position = 0
	return (
		store.tokens.map(token => {
			const length = isAnnotated(token) ? token.annotation.length : token.label.length
			position += length
			return position - length
		}) ?? []
	)
}

/**
 * Parse with ParserV2 and adapt to MarkStruct[] format
 */
function parseWithAdapter(value: string, options: any[]) {
	// Convert ParserV1 markups to ParserV2 format
	const markupsV2 = options?.map(opt => convertMarkupV1ToV2(opt.markup))
	
	if (!markupsV2 || markupsV2.length === 0) {
		return [{label: value}]
	}
	
	const parser = new ParserV2(markupsV2)
	const tokens = parser.parse(value)
	return adaptTokensToMarkStruct(tokens)
}

