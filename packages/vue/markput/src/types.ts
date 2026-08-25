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
	/**
	 * A row kind's component is a SLOT component: `class` and `style` fall through onto its root
	 * element unless it declares `inheritAttrs: false`, and the editor's own `ref` resolves
	 * through the component instance. Its default slot is the row's rendered inline content.
	 */
	class?: string
	style?: CSSProperties
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
	/**
	 * The structural row separator (issue 08, ADR-0011): editor-level, never part of any markup,
	 * and the whole of what makes a document rows. Default '\n\n'.
	 *
	 * `null` says the value never splits: one document, no rows, no row controls — a plain
	 * annotated text field.
	 *
	 * An empty string separates nothing: the editor reports it and renders the document as if it
	 * were `null`.
	 */
	separator?: string | null
	draggable?: boolean | DraggableConfig
}

export interface Slots {
	container?: string | Slot
}

export interface SlotProps {
	container?: Record<string, unknown> & DataAttributes
}