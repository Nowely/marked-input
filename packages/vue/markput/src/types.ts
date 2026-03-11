import type {CoreOption, DataAttributes, OverlayTrigger} from '@markput/core'
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
	/** Enable Notion-like draggable blocks with drag handles for reordering.
	 * Pass an object to configure block behavior, e.g. `{ alwaysShowHandle: true }` for mobile.
	 */
	block?: boolean | {alwaysShowHandle: boolean}
	/** Enable drag mode: each individual token (mark or text) becomes its own draggable row.
	 * Unlike `block`, rows are token-granular — one mark per row, one text fragment per row.
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