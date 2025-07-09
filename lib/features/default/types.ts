import {MarkedInputProps} from '../../components/MarkedInput'
import {Markup, Option, OverlayTrigger} from '../../types'

export interface InnerMarkedInputProps extends MarkedInputProps<unknown> {
	options: InnerOption[]
	trigger: OverlayTrigger
}

export interface InnerOption extends Option<unknown> {
	markup: Markup
	trigger: string
	data: string[]
}