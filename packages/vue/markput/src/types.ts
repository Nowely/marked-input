import type {CoreOption, DataAttributes, OverlayTrigger} from '@markput/core'
import type {Component, CSSProperties} from 'vue'

export interface MarkProps {
	value?: string
	meta?: string
	children?: any
}

export interface OverlayProps {
	trigger?: string
	data?: string[]
}

export interface Option<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreOption {
	Mark?: Component
	mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
	Overlay?: Component
	overlay?: TOverlayProps
}

export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps = OverlayProps> {
	Mark?: Component
	Overlay?: Component
	options?: Option<TMarkProps, TOverlayProps>[]
	className?: string
	style?: CSSProperties
	slots?: Slots
	slotProps?: SlotProps
	showOverlayOn?: OverlayTrigger
	value?: string
	defaultValue?: string
	readOnly?: boolean
	/** Enable drag mode: each individual token (mark or text) becomes its own draggable row.
	 * One mark per row, one text fragment per row.
	 * Adjacent marks need no separator; adjacent text rows are separated by `\n\n`.
	 */
	drag?: boolean | {alwaysShowHandle: boolean}
}

export interface Slots {
	container?: string | Component
	span?: string | Component
}

export interface SlotProps {
	container?: Record<string, unknown> & DataAttributes
	span?: Record<string, unknown> & DataAttributes
}