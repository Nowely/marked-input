import type {CoreOption, DataAttributes, DraggableConfig, OverlayTrigger, Slot} from '@markput/core'
import type {Component, CSSProperties, VNodeChild} from 'vue'

export interface MarkProps {
	value?: string
	meta?: string
	children?: VNodeChild
}

export interface OverlayProps {
	trigger?: string
	data?: string[]
}

export interface Option<
	TMarkProps = MarkProps,
	TOverlayProps extends CoreOption['overlay'] = OverlayProps,
> extends CoreOption {
	Mark?: Component
	mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
	Overlay?: Component
	overlay?: TOverlayProps
}

export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps extends CoreOption['overlay'] = OverlayProps> {
	Span?: Component
	Mark?: Component
	Overlay?: Component
	options?: Option<TMarkProps, TOverlayProps>[]
	class?: string
	style?: CSSProperties
	slots?: Slots
	slotProps?: SlotProps
	showOverlayOn?: OverlayTrigger
	value?: string
	defaultValue?: string
	readOnly?: boolean
	layout?: 'inline' | 'block'
	draggable?: boolean | DraggableConfig
}

export interface Slots {
	container?: string | Slot
}

export interface SlotProps {
	container?: Record<string, unknown> & DataAttributes
}