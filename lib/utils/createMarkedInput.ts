import {ForwardedRef, forwardRef} from 'react'
import {_MarkedInput, MarkedInputProps} from '../components/MarkedInput'
import {ConfiguredMarkedInput, MarkStruct} from '../types'
import {assign} from './index'

/**
 * Create the configured MarkedInput component.
 */
export function createMarkedInput<T = MarkStruct>(configs: Omit<MarkedInputProps<T>, 'value' | 'onChange'>): ConfiguredMarkedInput<T> {
	const ConfiguredMarkedInput = (props: MarkedInputProps<any>, ref: ForwardedRef<any>) => {
		const assignedProps: MarkedInputProps = assign({}, configs, props)
		return _MarkedInput(assignedProps, ref)
	}

	return forwardRef(ConfiguredMarkedInput)
}