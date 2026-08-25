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
	/** Nesting depth, counted from the roots. */
	depth: number
	/** Position among the row's own SIBLINGS — a group wrapper does not renumber the list. */
	index: number
	/** The live row node: its id, its own text and its verbs. */
	node: RowNode
	/**
	 * A row kind's component is a SLOT component: `class` and `style` fall through onto its root
	 * element unless it declares `inheritAttrs: false`, and the editor's own `ref` resolves
	 * through the component instance. Its default slot is the row's rendered inline content.
	 *
	 * Its `rows` SLOT is the row's CHILD ROWS, already rendered, and is absent when there are
	 * none — React passes the same thing as a `rows` PROP, which is the one place the two
	 * adapters' row contract differs, because a rendered node is a slot in Vue and a node in
	 * React. A kind that renders neither them nor a wrapper keeps its child rows in the value and
	 * off the screen: they round-trip and reappear when the row is outdented. A collapsed row is
	 * HIDDEN, never unmounted — an unpainted row leaves `bind` and takes its anchors with it.
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
	 * and the whole of what makes a document rows. Default '\n'.
	 *
	 * `null` says the value never splits: one document, no rows, no row controls — a plain
	 * annotated text field.
	 *
	 * An empty string separates nothing: the editor reports it and renders the document as if it
	 * were `null`.
	 */
	separator?: string | null
	/**
	 * The indent unit a NESTED row leads with (ADR-0010): editor-level like `separator`, and
	 * structural in the same sense — a leading run of it at a row's own start belongs to no markup
	 * and no caret may enter it. Default '\t'.
	 *
	 * `''` turns nesting off, and with it row TYPING on every indented line: a line whose first
	 * character is not an opener is a paragraph. Pass it when the document stores leading
	 * indentation as content.
	 */
	indent?: string
	draggable?: boolean | DraggableConfig
}

export interface Slots {
	container?: string | Slot
}

export interface SlotProps {
	container?: Record<string, unknown> & DataAttributes
}