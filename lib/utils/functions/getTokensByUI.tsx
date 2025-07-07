import {DefaultOptions} from '../../constants'
import {Parser} from '../classes/Parser/Parser'
import {Store} from '../classes/Store'

/**
 * Parse current focused token
 */
export function getTokensByUI(store: Store) {
	const {focus, props} = store
	const options = store.props.Mark ? store.props.options : undefined
	//TODO temp hack
	const optionsWithDefault = options?.map((option) => Object.assign({}, DefaultOptions[0], option))
	const tokens = Parser.split(focus.content, optionsWithDefault)

	if (tokens.length === 1) return store.tokens

	return store.tokens.toSpliced(focus.index, 1, ...tokens)
}