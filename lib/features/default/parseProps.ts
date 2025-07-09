import {MarkedInputProps} from '../../components/MarkedInput'
import {Option} from '../../types'
import {DEFAULT_CLASS_NAME, DEFAULT_MARKUP, DEFAULT_OPTIONS, DEFAULT_TRIGGER} from './constants'
import {InnerMarkedInputProps, InnerOption} from './types'

export function parseProps(props: MarkedInputProps<any>): InnerMarkedInputProps {
	return {
		...props,
		options: props.options ? props.options.map(parseOption) : DEFAULT_OPTIONS,
		trigger: props.trigger ?? 'change',
		className: props.className ? DEFAULT_CLASS_NAME + ' ' + props.className : DEFAULT_CLASS_NAME
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


