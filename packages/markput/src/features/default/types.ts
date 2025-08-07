import {MarkedInputProps} from '../../components/MarkedInput'
import {InnerOption} from '@markput/core'
import {OverlayTrigger} from '../../types'

export interface InnerMarkedInputProps extends MarkedInputProps<unknown> {
	options: InnerOption[]
	trigger: OverlayTrigger
	className: string
}
