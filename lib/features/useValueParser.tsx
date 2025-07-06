import {useEffect, useRef} from 'react'
import {DefaultOptions, SystemEvent} from '../constants'
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
			store.bus.send(SystemEvent.Parse)
			return
		}

		//TODO temp hack
		const optionsWithDefault = options?.map((option) => Object.assign({}, DefaultOptions[0], option))

		//Initial parse
		store.tokens = Parser.split(value ?? store.props.defaultValue ?? '', optionsWithDefault)
		isMounted.current = true
	}, [value, options])
}