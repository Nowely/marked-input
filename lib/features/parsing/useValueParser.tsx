import {useEffect, useRef} from 'react'
import {SystemEvent} from '../../constants'
import {useListener} from '../../utils/hooks/useListener'
import {useStore} from '../../utils/hooks/useStore'
import {getTokensByUI} from './getTokensByUI'
import {getTokensByValue} from './getTokensByValue'
import {Parser} from './Parser/Parser'

export const useValueParser = () => {
	const store = useStore()
	const isMounted = useRef(false)
	const {value, options} = useStore(store => ({
		value: store.props.value,
		options: store.props.Mark ? store.props.options : undefined,
	}), true)

	useEffect(() => {
		if (isMounted.current) {
			store.bus.send(SystemEvent.Parse)
			return
		}

		//Initial parse
		store.tokens = Parser.split(value ?? store.props.defaultValue ?? '', options)
		isMounted.current = true
	}, [value, options])

	useListener(SystemEvent.Parse, (event) => {
		store.tokens = store.focus.target
			? getTokensByUI(store)
			: getTokensByValue(store)
	}, [])
}