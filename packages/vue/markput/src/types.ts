import type {
	CoreOption,
	CoreSlotProps,
	CoreSlots,
	DataAttributes,
	DraggableConfig,
	OverlayTrigger,
	RowNode,
	Slot,
	Suggestion,
} from '@markput/core'
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
 *
 * NEITHER IS `class` OR `style`, and their absence is the contract rather than an omission. A row
 * kind's component is a SLOT component: both are FALLTHROUGH ATTRIBUTES, which Vue merges onto its
 * root element unless it declares `inheritAttrs: false`, and the editor's own `ref` resolves
 * through the component instance — so there is nothing to spread. Declaring either as a prop is
 * what breaks it: Vue removes a DECLARED key from `$attrs`, so a kind written as
 * `defineProps<RowProps>()` would take the editor's class and style out of the fallthrough and
 * paint neither — measured, `<div class="mine">` with no `_Row_` class and no drag opacity, which
 * costs the row its containing block, its `min-height` and the empty-row rule the caret needs.
 * `Base.fixtures.vue.ts` pins this key set against the type.
 *
 * Its `rows` SLOT is the row's CHILD ROWS, already rendered, and is absent when there are none —
 * React passes the same thing as a `rows` PROP, which is the one place the two adapters' row
 * contract differs, because a rendered node is a slot in Vue and a node in React. A kind that
 * renders neither them nor a wrapper keeps its child rows in the value and off the screen: they
 * round-trip and reappear when the row is outdented. A collapsed row is HIDDEN, never unmounted —
 * an unpainted row leaves `bind` and takes its anchors with it. Its default slot is the row's
 * rendered inline content.
 */
export interface RowProps {
	/** The kind's metadata gap — a todo's checked flag, a fence's language. */
	meta?: string
	/**
	 * Nesting depth, counted from 0: a ROOT row is at depth 0, its child at depth 1.
	 *
	 * THERE IS NO SIBLING POSITION BESIDE IT. Number a run with a CSS counter, which the browser
	 * keeps exact for free — the row-kinds guide has the rule to copy. Why the prop was removed
	 * rather than made cheaper is ADR-0013.
	 */
	depth: number
	/**
	 * The live row node: its id, its own text and its verbs — and REACTIVE, which a `RowNode` is
	 * not on its own. What the node answers are core's signals, which Vue does not track, so the
	 * one a kind receives is wrapped: every read touches this row's subscription inside the
	 * READER's effect, so `computed(() => node.slot())` in a child component re-reads after an
	 * edit. Reading outside a reactive scope captures a value, as any one-time read would.
	 *
	 * THE WRAPPER IS NOT THE OBJECT THE EDITOR HOLDS. Compare rows by `node.id`, never by `===`;
	 * methods, reads and verbs are unchanged (ADR-0014).
	 */
	node: RowNode
}

export interface OverlayProps {
	trigger?: string
	data?: readonly Suggestion[]
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
	/**
	 * Does the editor keep its own undo stack (ADR-0012). Default true: Ctrl/Cmd+Z undoes and
	 * Shift+Ctrl/Cmd+Z redoes, in both value modes — in a controlled editor an entry is recorded
	 * only once the parent has echoed the value back, so an emission your `change` handler
	 * declines leaves nothing behind.
	 *
	 * `false` turns both keys back into no-ops. It does NOT hand undo to the browser: the input
	 * guard has swallowed native undo since ADR-0006, because a native undo would edit DOM the
	 * model owns.
	 */
	history?: boolean
	draggable?: boolean | DraggableConfig
}

/**
 * Available slots for customizing MarkedInput internal components. EXTENDS the core contract, so a
 * slot core learns to resolve is a slot this type declares.
 */
export interface Slots extends CoreSlots {
	/** Root container component */
	container?: Slot | string
}

/**
 * Props merged onto the components the editor paints itself. EXTENDS the core contract, so a key
 * core learns to read is a key this type declares.
 *
 * Not the same key set as {@link Slots}, and the names say why: `slots.paragraph` is consulted only
 * for a row with NO kind, while `slotProps.row` reaches every row.
 *
 * THE CLASS KEY IS `className` HERE, in both adapters — this is core's bag, and it merges what it
 * finds under that name with the editor's own. A key spelled `class` is REFUSED rather than merged:
 * it type-checks, because the bag is open, and it reaches nothing. Vue's own `class` spelling is
 * what a ROW KIND's component and a `slots.container` component receive, by fallthrough.
 */
export interface SlotProps extends CoreSlotProps {
	container?: CoreSlotProps['container'] & DataAttributes
	/** Merged onto EVERY row's wrapper — kind or paragraph alike, unlike `slots.paragraph`. */
	row?: CoreSlotProps['row'] & DataAttributes
}