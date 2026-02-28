import {cx, merge} from '@markput/core'
import styles from '@markput/core/styles.module.css'
import type {MarkedInputProps} from '../../components/MarkedInput'
import {DEFAULT_OPTIONS} from '../../constants'

export function normalizeProps(props: MarkedInputProps): MarkedInputProps {
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
