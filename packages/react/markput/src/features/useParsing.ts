import {useEffect, useRef} from 'react'
import {useListener} from '../lib/hooks/useListener'
import {useStore} from '../lib/hooks/useStore'
import {getTokensByUI, getTokensByValue, Parser, parseWithParser, SystemEvent} from '@markput/core'

export function useParsing() {
	const store = useStore()

	// useValueParser
	const isMounted = useRef(false)
	const {value, options} = useStore(
		store => ({
			value: store.props.value,
			options: store.props.Mark ? store.props.options : undefined,
		}),
		true
	)

	useEffect(() => {
		const markups = options?.map(opt => opt.markup)
		if (markups && markups.some(Boolean)) {
			store.parser = new Parser(markups)
		} else {
			store.parser = undefined
		}

		if (isMounted.current) {
			store.bus.send(SystemEvent.Parse)
			return
		}

		const inputValue = value ?? store.props.defaultValue ?? ''
		store.tokens = parseWithParser(store, inputValue)

		isMounted.current = true
	}, [value, options])

	useListener(
		SystemEvent.Parse,
		() => {
			store.tokens = store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store)
		},
		[]
	)
}
