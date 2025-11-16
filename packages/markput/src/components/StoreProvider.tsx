import {ReactNode, useEffect, useState} from 'react'
import {Store, DEFAULT_CLASS_NAME, DEFAULT_OPTIONS} from '@markput/core'
import {MarkedInputProps} from './MarkedInput'
import {StoreContext} from '../utils/providers/StoreContext'
import {mergeClassNames, mergeStyles} from '../utils/functions/resolveSlot'

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

function normalizeProps(props: MarkedInputProps<any>): MarkedInputProps {
	const className = mergeClassNames(DEFAULT_CLASS_NAME, props.className, props.slotProps?.container?.className)
	const style = mergeStyles(props.style, props.slotProps?.container?.style)

	return {
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: props.onChange,
		readOnly: props.readOnly,
		options: props.options ? props.options : DEFAULT_OPTIONS,
		trigger: props.trigger ?? 'change',
		className,
		style,
		Mark: props.Mark,
		Overlay: props.Overlay,
		slots: props.slots,
		slotProps: props.slotProps,
	}
}
