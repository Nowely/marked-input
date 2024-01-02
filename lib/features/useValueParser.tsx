import {useEffect, useRef} from 'react'
import {SystemEvent} from '../constants'
import {Parser} from '../utils/classes/Parser/Parser'
import {useStore} from '../utils/hooks/useStore'

export const useValueParser = () => {
	const store = useStore()
	const isMounted = useRef(false)
	const {value, options} = useStore(store => ({
		value: store.props.value,
		options: store.props.Mark ? store.props.options : undefined,
	}), true)

	useEffect(() => {
		if (isMounted.current) {
			store.bus.send(SystemEvent.Reparce)
			return
		}

		//Initial parse
		store.tokens = Parser.split(value ?? store.props.defaultValue ?? '', options)
		isMounted.current = true
	}, [value, options])
}