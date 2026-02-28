import {useEffect, useImperativeHandle, useRef} from 'react'
import type {MarkedInputHandler, Option} from '../../types'
import type {Store} from '@markput/core'
import {createCoreFeatures, getTokensByUI, getTokensByValue, Parser, parseWithParser} from '@markput/core'
import {useListener} from './useListener'
import {useStore} from './useStore'
import {useReactive} from './useReactive'

const initHandler = (store: Store): MarkedInputHandler => ({
	get container() {
		return store.refs.container
	},
	get overlay() {
		return store.refs.overlay
	},
	focus() {
		store.nodes.focus.head?.focus()
	},
})

export function useCoreFeatures(ref: React.Ref<MarkedInputHandler> | undefined) {
	const store = useStore()
	const isMounted = useRef(false)

	useImperativeHandle(ref, () => initHandler(store), [store])

	useEffect(() => {
		const features = createCoreFeatures(store)
		features.enableAll()
		return () => features.disableAll()
	}, [])

	const value = store.props.value
	const Mark = store.props.Mark
	const options = Mark ? store.props.options : undefined

	useEffect(() => {
		const markups = options?.map(opt => opt.markup)
		if (markups && markups.some(Boolean)) {
			store.state.parser(new Parser(markups))
		} else {
			store.state.parser(undefined)
		}

		if (isMounted.current) {
			store.events.parse()
			return
		}

		const inputValue = value ?? store.props.defaultValue ?? ''
		store.state.tokens(parseWithParser(store, inputValue))

		isMounted.current = true
	}, [value, options])

	useListener(
		store.events.parse,
		() => {
			if (store.state.recovery()) return
			store.state.tokens(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
		},
		[]
	)

	const tokens = useReactive(store.state.tokens)
	useEffect(
		() => {
			store.controllers.focus.recover()
		},
		store.props.Mark ? [tokens] : undefined
	)

	useEffect(() => {
		store.controllers.overlay.enableTrigger<Option>(
			(option: Option) => option.overlay?.trigger,
			match => store.state.overlayMatch(match)
		)
		return () => store.controllers.overlay.disable()
	}, [])

	const overlayMatch = useReactive(store.state.overlayMatch)
	useEffect(() => {
		if (!overlayMatch) return
		store.controllers.overlay.enableClose()
		return () => store.controllers.overlay.disable()
	}, [overlayMatch])
}
