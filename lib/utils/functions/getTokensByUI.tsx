import {Store} from '../classes/Store'
import {Option} from '../../types'
import {Parser} from '../classes/Parser/Parser'

export function getTokensByUI(store: Store) {
	const {focus, props: {options}} = store
	const tokens = Parser.split(focus.content, options)

	if (tokens.length === 1) return store.tokens

	return store.tokens.toSpliced(focus.index, 1, ...tokens)
}