import {MarkedInputProps} from '../../components/MarkedInput'
import {Option} from '../../types'
import {
	DEFAULT_CLASS_NAME,
	DEFAULT_MARKUP,
	DEFAULT_OPTIONS,
	DEFAULT_TRIGGER,
	InnerOption,
} from '@markput/core'
import {mergeClassNames, mergeStyles} from '../../utils/functions/resolveSlot'
import {StoreProps} from '../../utils/providers/StoreContext'

export function parseProps(props: MarkedInputProps<any>): StoreProps {
	const className = mergeClassNames(
		DEFAULT_CLASS_NAME,
		props.className,
		props.slotProps?.container?.className
	)

	const style = mergeStyles(
		props.style,
		props.slotProps?.container?.style
	)

	return {
		value: props.value,
		defaultValue: props.defaultValue,
		onChange: props.onChange,
		readOnly: props.readOnly,
		options: props.options ? props.options.map(parseOption) : DEFAULT_OPTIONS,
		trigger: props.trigger ?? 'change',
		className,
		style,
		Mark: props.Mark,
		Overlay: props.Overlay,
		slots: props.slots,
		slotProps: props.slotProps,
	}
}

function parseOption(option: Option<any>): InnerOption {
	return {
		...option,
		data: option.data ?? [],
		markup: option.markup ?? DEFAULT_MARKUP,
		trigger: option.trigger ?? DEFAULT_TRIGGER,
	}
}
