import type {ReactNode} from 'react'
import {useEffect, useState} from 'react'
import {Store, DEFAULT_CLASS_NAME} from '@markput/core'
import type {MarkedInputProps} from './MarkedInput'
import {StoreContext} from '../utils/providers/StoreContext'
import {mergeClassNames, mergeStyles} from '../utils/functions/resolveSlot'
import {DEFAULT_OPTIONS} from '../constants'

interface StoreProviderProps {
	props: MarkedInputProps
	children: ReactNode
}

export const StoreProvider = ({props, children}: StoreProviderProps) => {
	const storeProps = normalizeProps(props)
	const [store] = useState(() => Store.create(storeProps))

	useEffect(() => {
		store.props = storeProps
	})

	return <StoreContext.Provider value={store} children={children} />
}

function normalizeProps(props: MarkedInputProps): MarkedInputProps {
	const className = mergeClassNames(DEFAULT_CLASS_NAME, props.className, props.slotProps?.container?.className)
	const style = mergeStyles(props.style, props.slotProps?.container?.style)

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
