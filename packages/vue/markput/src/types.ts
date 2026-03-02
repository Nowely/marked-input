import type {Component} from 'vue'
import type {CoreOption} from '@markput/core'

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

export interface Slots {
	container?: string
	span?: string
}

export type DataAttributes = Record<`data${Capitalize<string>}`, string | number | boolean | undefined>

export interface SlotProps {
	container?: Record<string, unknown> & DataAttributes
	span?: Record<string, unknown> & DataAttributes
}
