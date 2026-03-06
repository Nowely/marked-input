import type {CoreOption, OverlayTrigger} from '@markput/core'
import type {Component, CSSProperties} from 'vue'

export interface MarkProps {
	slot?: Component
	value?: string
	meta?: string
	nested?: string
	children?: any
}

export interface OverlayProps {
	slot?: Component
	trigger?: string
	data?: string[]
}

export interface Option<TMarkProps = MarkProps, TOverlayProps = OverlayProps> extends CoreOption {
	mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
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
	/** Enable Notion-like draggable blocks with drag handles for reordering */
	block?: boolean
}

export interface Slots {
	container?: string | Component
	span?: string | Component
}

export type DataAttributes = Record<`data${Capitalize<string>}`, string | number | boolean | undefined>

export interface SlotProps {
	container?: Record<string, unknown> & DataAttributes
	span?: Record<string, unknown> & DataAttributes
}