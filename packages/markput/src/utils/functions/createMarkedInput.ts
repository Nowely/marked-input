import type {ForwardedRef} from 'react'
import {forwardRef} from 'react'
import type {MarkedInputProps} from '../../components/MarkedInput'
import {_MarkedInput} from '../../components/MarkedInput'
import type {ConfiguredMarkedInput, MarkProps, OverlayProps} from '../../types'

/**
 * Create the configured MarkedInput component.
 *
 * @template TMarkProps - Type of props for the global Mark component
 * @template TOverlayProps - Type of props for the global Overlay component
 */
export function createMarkedInput<TMarkProps = MarkProps, TOverlayProps = OverlayProps>(
	configs: Omit<MarkedInputProps<TMarkProps, TOverlayProps>, 'value' | 'onChange'>
): ConfiguredMarkedInput<TMarkProps, TOverlayProps> {
	const ConfiguredMarkedInput = (props: MarkedInputProps<TMarkProps, TOverlayProps>, ref: ForwardedRef<any>) => {
		const assignedProps = Object.assign({}, configs, props) as MarkedInputProps
		return _MarkedInput(assignedProps, ref)
	}

	return forwardRef(ConfiguredMarkedInput) as ConfiguredMarkedInput<TMarkProps, TOverlayProps>
}
