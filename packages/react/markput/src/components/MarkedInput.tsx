import type {ComponentType, CSSProperties, Ref} from 'react'
import {useEffect, useImperativeHandle, useRef} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {StoreProvider} from './StoreProvider'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, OverlayTrigger, Store} from '@markput/core'
import {createCoreFeatures, getTokensByUI, getTokensByValue, Parser, parseWithParser, SystemEvent} from '@markput/core'
import {useListener} from '../lib/hooks/useListener'
import {useStore} from '../lib/hooks/useStore'

export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreMarkputProps {
	ref?: Ref<MarkedInputHandler>
	Mark?: ComponentType<TMarkProps>
	Overlay?: ComponentType<TOverlayProps>
	options?: Option<TMarkProps, TOverlayProps>[]
	className?: string
	style?: CSSProperties
	slots?: Slots
	slotProps?: SlotProps
	showOverlayOn?: OverlayTrigger
}

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

function Features({ref}: {ref?: Ref<MarkedInputHandler>}) {
	const store = useStore()
	const isMounted = useRef(false)

	// Imperative handle
	useImperativeHandle(ref, () => initHandler(store), [store])

	// Core features (keydown, system, focus, textSelection)
	useEffect(() => {
		const features = createCoreFeatures(store)
		features.enableAll()
		return () => features.disableAll()
	}, [])

	// Parsing
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
			if (store.recovery) return
			store.tokens = store.nodes.focus.target ? getTokensByUI(store) : getTokensByValue(store)
		},
		[]
	)

	// Focus recovery
	const tokens = useStore(s => s.tokens)
	useEffect(
		() => {
			store.controllers.focus.recover()
		},
		store.props.Mark ? [tokens] : undefined
	)

	// Overlay trigger (always enabled)
	useEffect(() => {
		store.controllers.trigger.enable<Option>(
			(option: Option) => option.overlay?.trigger,
			match => (store.overlayMatch = match)
		)
		return () => store.controllers.trigger.disable()
	}, [])

	// Check trigger (always enabled - listens for changes to trigger overlay)
	useEffect(() => {
		store.controllers.checkTrigger.enable()
		return () => store.controllers.checkTrigger.disable()
	}, [])

	// Close overlay (conditional on match)
	const overlayMatch = useStore(s => s.overlayMatch, true)
	useEffect(() => {
		if (!overlayMatch) return
		store.controllers.closeOverlay.enable()
		return () => store.controllers.closeOverlay.disable()
	}, [overlayMatch])

	return null
}

export function MarkedInput<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
	props: MarkedInputProps<TMarkProps, TOverlayProps>
) {
	const {ref, ...rest} = props
	return (
		<StoreProvider props={rest as MarkedInputProps}>
			<Container />
			<Whisper />
			<Features ref={ref} />
		</StoreProvider>
	)
}
