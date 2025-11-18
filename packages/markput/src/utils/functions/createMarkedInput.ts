import type {ForwardedRef} from 'react'
import {forwardRef} from 'react'
import type {MarkedInputProps} from '../../components/MarkedInput'
import {_MarkedInput} from '../../components/MarkedInput'
import type {ConfiguredMarkedInput, MarkProps, OverlayProps} from '../../types'

/**
 * Create the configured MarkedInput component.
 *
 * @template TMarkProps - Type of props for the Mark component (default: MarkProps)
 * @template TOverlayProps - Type of props for the Overlay component (default: OverlayProps)
 */
export function createMarkedInput<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
	configs: Omit<MarkedInputProps<TMarkProps, TOverlayProps>, 'value' | 'onChange'>
): ConfiguredMarkedInput<TMarkProps, TOverlayProps> {
	const ConfiguredMarkedInput = (props: MarkedInputProps<any, any>, ref: ForwardedRef<any>) => {
		const assignedProps: MarkedInputProps = Object.assign({}, configs, props)
		return _MarkedInput(assignedProps, ref)
	}

	return forwardRef(ConfiguredMarkedInput) as ConfiguredMarkedInput<TMarkProps, TOverlayProps>
}
