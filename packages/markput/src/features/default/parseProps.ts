import {MarkedInputProps} from '../../components/MarkedInput'
import {DEFAULT_CLASS_NAME, DEFAULT_OPTIONS} from '@markput/core'
import {mergeClassNames, mergeStyles} from '../../utils/functions/resolveSlot'

export function parseProps(props: MarkedInputProps<any>): MarkedInputProps {
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
