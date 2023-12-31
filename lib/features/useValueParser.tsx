import {useEffect} from 'react'
import {useStore} from '../utils/hooks/useStore'
import {getTokensByUI} from '../utils/functions/getTokensByUI'
import {getTokensByValue} from '../utils/functions/getTokensByValue'

export const useValueParser = () => {
	const store = useStore()
	const {value, options} = useStore(store => ({
		value: store.props.value,
		options: store.props.Mark ? store.props.options : undefined,
	}), true)

	useEffect(() => {
		store.tokens = store.focus.target
			? getTokensByUI(store)
			: getTokensByValue(store)
	}, [value, options])
}