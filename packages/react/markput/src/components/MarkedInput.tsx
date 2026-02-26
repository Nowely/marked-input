import type {ComponentType, CSSProperties, Ref} from 'react'
import {useEffect, useState} from 'react'
import type {MarkedInputHandler, MarkProps, Option, OverlayProps, SlotProps, Slots} from '../types'
import {Container} from './Container'
import {Whisper} from './Whisper'
import type {CoreMarkputProps, OverlayTrigger} from '@markput/core'
import {cx, merge, Store} from '@markput/core'
import styles from '@markput/core/styles.module.css'
import {StoreContext} from '../lib/providers/StoreContext'
import {useCoreFeatures} from '../lib/hooks/useCoreFeatures'
import {DEFAULT_OPTIONS} from '../constants'

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

function normalizeProps(props: MarkedInputProps): MarkedInputProps {
	const className = cx(styles.Container, props.className, props.slotProps?.container?.className)
	const style = merge(props.style, props.slotProps?.container?.style)

	return {
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: props.onChange,
		readOnly: props.readOnly,
		options: props.options ?? DEFAULT_OPTIONS,
		showOverlayOn: props.showOverlayOn ?? 'change',
		className,
		style,
		Mark: props.Mark,
		Overlay: props.Overlay,
		slots: props.slots,
		slotProps: props.slotProps,
	}
}

function MarkedInputInner({ref}: {ref?: Ref<MarkedInputHandler>}) {
	useCoreFeatures(ref)
	return (
		<>
			<Container />
			<Whisper />
		</>
	)
}

export function MarkedInput<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
	props: MarkedInputProps<TMarkProps, TOverlayProps>
) {
	const {ref, ...rest} = props
	const storeProps = normalizeProps(rest as MarkedInputProps)
	const [store] = useState(() => new Store(storeProps))

	useEffect(() => {
		store.props = storeProps
	})

	return (
		<StoreContext.Provider value={store}>
			<MarkedInputInner ref={ref} />
		</StoreContext.Provider>
	)
}
