import {ForwardedRef, forwardRef} from 'react'
import {_MarkedInput, MarkedInputProps} from '../../components/MarkedInput'
import {ConfiguredMarkedInput} from '../../types'
import {Token} from '@markput/core'

/**
 * Create the configured MarkedInput component.
 */
export function createMarkedInput<T = Token>(
	configs: Omit<MarkedInputProps<T>, 'value' | 'onChange'>
): ConfiguredMarkedInput<T> {
	const ConfiguredMarkedInput = (props: MarkedInputProps<any>, ref: ForwardedRef<any>) => {
		const assignedProps: MarkedInputProps = Object.assign({}, configs, props)
		return _MarkedInput(assignedProps, ref)
	}

	return forwardRef(ConfiguredMarkedInput) as ConfiguredMarkedInput<T>
}
