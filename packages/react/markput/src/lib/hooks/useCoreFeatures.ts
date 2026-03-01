import {useEffect, useImperativeHandle, useRef} from 'react'
import type {Option} from '../../types'
import type {MarkputHandler, Store} from '@markput/core'
import {createCoreFeatures, getTokensByUI, getTokensByValue, Parser, parseWithParser, toString} from '@markput/core'
import {useListener} from './useListener'

export function useCoreFeatures(store: Store, ref: React.Ref<MarkputHandler> | undefined) {
	const isInitialized = useRef(false)

	useImperativeHandle(ref, () => store.createHandler(), [store])

	useEffect(() => {
		const features = createCoreFeatures(store)
		features.enableAll()
		return () => features.disableAll()
	}, [])

	const value = store.state.value.use()
	const Mark = store.state.Mark.use()
	const coreOptions = store.state.options.use()
	// options only matters when Mark is provided; omitting it prevents unnecessary re-parses
	const options = Mark ? coreOptions : undefined

	useEffect(() => {
		const markups = options?.map(opt => opt.markup)
		if (markups && markups.some(Boolean)) {
			store.state.parser.set(new Parser(markups))
		} else {
			store.state.parser.set(undefined)
		}

		if (isInitialized.current) {
			if (!store.state.recovery.get()) {
				store.events.parse()
			}
			return
		}

		const inputValue = value ?? store.state.defaultValue.get() ?? ''
		store.state.tokens.set(parseWithParser(store, inputValue))

		isInitialized.current = true
	}, [value, options])

	useListener(
		store.events.parse,
		() => {
			if (store.state.recovery.get()) {
				const text = toString(store.state.tokens.get())
				store.state.tokens.set(parseWithParser(store, text))
				store.state.previousValue.set(text)
				return
			}
			store.state.tokens.set(store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store))
		},
		[]
	)

	const tokens = store.state.tokens.use()
	useEffect(() => {
		if (!store.state.Mark.get()) return
		store.controllers.focus.recover()
	}, [tokens])

	useEffect(() => {
		store.controllers.overlay.enableTrigger<Option>(
			(option: Option) => option.overlay?.trigger,
			match => store.state.overlayMatch.set(match)
		)
		return () => store.controllers.overlay.disable()
	}, [])

	const overlayMatch = store.state.overlayMatch.use()
	useEffect(() => {
		if (!overlayMatch) return
		store.controllers.overlay.enableClose()
		return () => store.controllers.overlay.disableClose()
	}, [overlayMatch])
}
