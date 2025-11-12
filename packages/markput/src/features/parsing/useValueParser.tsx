import {useEffect, useRef} from 'react'
import {useListener} from '../../utils/hooks/useListener'
import {useStore} from '../../utils/hooks/useStore'
import {getTokensByUI} from './getTokensByUI'
import {getTokensByValue} from './getTokensByValue'
import {Parser as ParserV2, SystemEvent} from '@markput/core'
import {adaptTokensToMarkStruct} from './adapter'
import {convertMarkupV1ToV2} from './markupConverter'

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
		if (isMounted.current) {
			store.bus.send(SystemEvent.Parse)
			return
		}

		//Initial parse with ParserV2
		const inputValue = value ?? store.props.defaultValue ?? ''
		const markupsV2 = options?.map(opt => convertMarkupV1ToV2(opt.markup))
		
		if (!markupsV2 || markupsV2.length === 0) {
			store.tokens = [{label: inputValue}]
		} else {
			const parser = new ParserV2(markupsV2)
			const tokens = parser.parse(inputValue)
			store.tokens = adaptTokensToMarkStruct(tokens)
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
