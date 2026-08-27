import type {
	CoreOption,
	CoreSlotProps,
	CoreSlots,
	CSSProperties,
	DataAttributes,
	RowNode,
	Suggestion,
} from '@markput/core'
import type {ComponentType, ElementType, ReactNode, RefCallback} from 'react'

/**
 * Props passed to Mark components.
 */
export interface MarkProps {
	/** Main content value of the mark */
	value?: string
	/** Additional metadata for the mark */
	meta?: string
	/** Rendered children content (ReactNode) for nested marks */
	children?: ReactNode
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
	/** The row's own inline content, already rendered. */
	children?: ReactNode
	/**
	 * The row's CHILD ROWS, already rendered; `undefined` when there are none. A kind that renders
	 * them decides where they go — a toggle hides them, a bullet nests a list inside its `<li>`.
	 *
	 * A kind that renders NEITHER them nor a wrapper for them keeps the rows in the value and off
	 * the screen: they round-trip and reappear when the row is outdented. That is Notion's own
	 * behaviour for a heading, and it is what declaring no "can this nest" flag costs.
	 *
	 * A collapsed row is HIDDEN, never unmounted: an unpainted row leaves `bind` and takes its
	 * anchors with it, so `End`, select-all and every arrow that resolves through the last row
	 * would walk into a row with no element.
	 */
	rows?: ReactNode
	/** Nesting depth, counted from 0: a ROOT row is at depth 0, its child at depth 1. */
	depth: number
	/**
	 * Position among the row's own SIBLINGS, and the one fact about a row that the row cannot
	 * answer for itself — a numbered list's ordinal is what needs it. Kept with no reader in this
	 * repo, deliberately: it is published surface with its own generated page, and only the parent
	 * that mapped the siblings knows it.
	 */
	index: number
	/** The live row node: its id, its own text and its verbs. */
	node: RowNode
	/**
	 * A row kind's component is a SLOT component: spread `ref`, `className` and `style` onto the
	 * element it renders, the way `slots.container` and `slots.paragraph` consumers already do. The
	 * ref is how the editor finds the row's element; a component that drops it leaves the row
	 * unbound, and the caret cannot resolve into it. That one is REPORTED — nothing on screen says
	 * it otherwise; the other two cost a row that looks wrong rather than one the editor cannot use.
	 */
	ref?: RefCallback<HTMLElement>
	className?: string
	style?: CSSProperties
}

/**
 * Props for Overlay components.
 */
export interface OverlayProps {
	/** Trigger character(s) that activate the overlay */
	trigger?: string
	/** Data array for suggestions/autocomplete */
	data?: readonly Suggestion[]
}

// ============================================================================
// Option Interface
// ============================================================================

/**
 * React-specific markup option for defining mark behavior and styling.
 *
 * @template TMarkProps - Type of props for the mark component
 * @template TOverlayProps - Type of props for the overlay component
 *
 * @example
 * const option: Option<ChipProps> = {
 *   markup: '@[__value__]',
 *   mark: { slot: Chip, label: 'Click' }
 * }
 */
export interface Option<
	TMarkProps = MarkProps,
	TOverlayProps extends CoreOption['overlay'] = OverlayProps,
> extends CoreOption {
	/** Per-option component for rendering this mark */
	Mark?: ComponentType<TMarkProps>
	/**
	 * Props for the mark component.
	 * Can be a static object or a function that transforms MarkProps.
	 */
	mark?: TMarkProps | ((props: MarkProps) => TMarkProps)
	/** Per-option component for rendering this overlay */
	Overlay?: ComponentType<TOverlayProps>
	/**
	 * Props for the overlay component.
	 */
	overlay?: TOverlayProps
}

/**
 * Available slots for customizing MarkedInput internal components
 */
export interface Slots extends CoreSlots {
	/** Root container component */
	container?: ElementType<Record<string, unknown>>
}

/**
 * Props merged onto the components the editor paints itself. EXTENDS the core contract, so a key
 * core learns to read is a key this type declares.
 *
 * Not the same key set as {@link Slots}, and the names say why: `slots.paragraph` is consulted only
 * for a row with NO kind, while `slotProps.row` reaches every row.
 */
export interface SlotProps extends CoreSlotProps {
	container?: CoreSlotProps['container'] & DataAttributes
	/** Merged onto EVERY row's wrapper — kind or paragraph alike, unlike `slots.paragraph`. */
	row?: CoreSlotProps['row'] & DataAttributes
}