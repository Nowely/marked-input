import {Store} from '@markput/core/src/utils/classes/Store'
import {Parser} from '@markput/core'

/**
 * Parse current focused token
 */
export function getTokensByUI(store: Store) {
	const {focus, props} = store
	const options = store.props.Mark ? store.props.options : undefined
	const tokens = Parser.split(focus.content, options)

	if (tokens.length === 1) return store.tokens

	return store.tokens.toSpliced(focus.index, 1, ...tokens)
}
