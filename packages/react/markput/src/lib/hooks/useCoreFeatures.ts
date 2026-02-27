import {useEffect, useImperativeHandle, useRef} from 'react'
import type {MarkedInputHandler, Option} from '../../types'
import type {Store} from '@markput/core'
import {createCoreFeatures, getTokensByUI, getTokensByValue, Parser, parseWithParser} from '@markput/core'
import {useListener} from './useListener'
import {useStore} from './useStore'

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

	const {value, options} = useStore(
		s => ({
			value: s.props.value,
			options: s.props.Mark ? s.props.options : undefined,
		}),
		true
	)

	useEffect(() => {
		const markups = options?.map(opt => opt.markup)
		if (markups && markups.some(Boolean)) {
			store.state.parser = new Parser(markups)
		} else {
			store.state.parser = undefined
		}

		if (isMounted.current) {
			store.events.parse.emit()
			return
		}

		const inputValue = value ?? store.props.defaultValue ?? ''
		store.state.tokens = parseWithParser(store, inputValue)

		isMounted.current = true
	}, [value, options])

	useListener(
		store.events.parse,
		() => {
			if (store.state.recovery) return
			store.state.tokens = store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store)
		},
		[]
	)

	const tokens = useStore(s => s.state.tokens)
	useEffect(
		() => {
			store.controllers.focus.recover()
		},
		store.props.Mark ? [tokens] : undefined
	)

	useEffect(() => {
		store.controllers.overlayTrigger.enable<Option>(
			(option: Option) => option.overlay?.trigger,
			match => (store.state.overlayMatch = match)
		)
		return () => store.controllers.overlayTrigger.disable()
	}, [])

	const overlayMatch = useStore(s => s.state.overlayMatch, true)
	useEffect(() => {
		if (!overlayMatch) return
		store.controllers.closeOverlay.enable()
		return () => store.controllers.closeOverlay.disable()
	}, [overlayMatch])
}
