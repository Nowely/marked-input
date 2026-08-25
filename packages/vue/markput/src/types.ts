import type {CoreOption, DataAttributes, DraggableConfig, OverlayTrigger, RowNode, Slot} from '@markput/core'
import type {Component, CSSProperties, VNodeChild} from 'vue'

export interface MarkProps {
	value?: string
	meta?: string
	children?: VNodeChild
}

/**
 * Props passed to a ROW KIND's component — what `option.row.Component` receives.
 *
 * A row's structural bytes are not among them: its opener and closing literal are the editor's,
 * not the document's, so they never reach a component and no caret may enter them.
 */
export interface RowProps {
	/** The kind's metadata gap — a todo's checked flag, a fence's language. */
	meta?: string
	/** The live row node: its id, its own text and its verbs. */
	node: RowNode
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
	/**
	 * The structural row separator for block layout (issue 08): editor-level, never part of
	 * any markup. Inline layout ignores it. Default '\n\n'.
	 *
	 * An empty string separates nothing: the editor reports it and renders one rowless
	 * document, with the row controls off.
	 */
	separator?: string
	draggable?: boolean | DraggableConfig
}

export interface Slots {
	container?: string | Slot
}

export interface SlotProps {
	container?: Record<string, unknown> & DataAttributes
}