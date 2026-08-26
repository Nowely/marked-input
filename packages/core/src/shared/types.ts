import type * as CSS from 'csstype'

import type {Markup} from '../features/tokens/parser/types'
import type {Anchors} from '../features/tokens/tree/types'

/**
 * Registry interface used as a module-augmentation target. Framework packages
 * add a `default` property whose type is the framework's component type.
 *
 * @example React augmentation
 * declare module '@markput/core' {
 *   interface SlotRegistry {
 *     default: import('react').ElementType
 *   }
 * }
 *
 * Without augmentation, `Slot` falls back to `unknown`.
 */
export interface SlotRegistry {}

/** Framework-provided component type. Resolves to `unknown` unless `SlotRegistry` is augmented. */
export type Slot = keyof SlotRegistry extends never ? unknown : SlotRegistry[keyof SlotRegistry]

/**
 * Core option for markups - Framework-agnostic configuration.
 * Extended by framework-specific Option types (e.g., React Option).
 *
 * Architecture:
 * - CoreOption: Contains only markup pattern (framework-independent)
 * - trigger configuration: read off `overlay.trigger` by the OverlayController's probe
 * - Separation of concerns: Core focuses on markup tokens, framework handles overlay triggers
 */
export interface CoreOption {
	/**
	 * Template string in which the mark is rendered.
	 * Must contain placeholders: `__value__`, `__meta__`, and/or `__slot__`
	 *
	 * Placeholder types:
	 * - `__value__` - main content (plain text, no nesting)
	 * - `__meta__` - additional metadata (plain text, no nesting)
	 * - `__slot__` - content supporting nested structures
	 *
	 * A markup that breaks those rules — no placeholder at all, too many of one kind, or a
	 * LEADING placeholder — is reported to the console and contributes nothing: the option is
	 * skipped and every other option keeps its index. Omitting `markup` does the same, quietly.
	 *
	 * "Contributes nothing" reaches the overlay too. An `overlay.trigger` on such an option still
	 * OPENS the overlay — that is how an overlay-only option is written — but choosing a
	 * suggestion inserts nothing rather than writing a markup no parser can read back.
	 *
	 * @example
	 * // Simple value
	 * "@[__value__]"
	 *
	 * @example
	 * // Value with metadata
	 * "@[__value__](__meta__)"
	 *
	 * @example
	 * // Nested content support
	 * "@[__slot__]"
	 */
	markup?: Markup
	/**
	 * Presence makes this a ROW option: its `markup` is matched ONLY at a row's own start, never
	 * anywhere inside a line, and matching it TYPES the row — the row renders through this
	 * option's own component instead of the paragraph slot.
	 *
	 * A row markup obeys the mark rules plus three of its own: exactly one body placeholder
	 * (`__slot__` for an inline-parsed body, `__value__` for a raw one), no second `__value__`,
	 * and no two placeholders touching. A markup that breaks one, or that compiles to an opener
	 * an earlier row option already claims, is reported and contributes no row kind.
	 */
	row?: RowSpec
	overlay?: {
		trigger?: string
		/** Rows the built-in Suggestions overlay filters against the match value. */
		data?: readonly Suggestion[]
	}
	/**
	 * ONE contribution to the row menu an overlay offers, and its PRESENCE is what puts the option
	 * there — an option that declares a menu entry IS the menu, so no list of kinds is written
	 * anywhere else and no consumer component filters one.
	 */
	menu?: MenuSpec
}

/** What an option declares to appear in {@link OverlayListModel.rows}. */
export interface MenuSpec {
	/** What the row shows, and the only text the typed query is matched against. */
	label: string
	/** Extra query terms that never appear on screen — `'h1'` for Heading 1. */
	keywords?: readonly string[]
	/**
	 * SEEDS for the row this entry writes, and both are DATA rather than a callback: the entry
	 * says what the row starts as, and `choose` is the only thing that writes it. They apply only
	 * where there is nothing to keep — a row that already has text keeps its own body, since a
	 * turn-into must not discard what the user typed.
	 */
	meta?: string
	text?: string
}

/**
 * ONE ROW of the list an open overlay offers: what to paint, and the pick that choosing it
 * commits. It is the SAME shape for a suggestion and for a row-menu entry, which is what let the
 * two lists collapse into {@link OverlayListModel} — a painter reads `label`, a click hands
 * `pick` straight back to `choose`, and neither has to know which source the row came from.
 *
 * Insert-versus-turn-into is NOT here and is not anywhere else either — it is a fact about the
 * caret's row that `choose` reads for itself, so no row and no overlay member carries a second
 * copy of it.
 */
export type OverlayRow = {label: string; pick: OverlayPick}

/**
 * WHAT AN OVERLAY ACCEPTS, and a UNION because the two arms are exclusive in fact: naming a row
 * KIND retypes the caret's row, naming a VALUE writes the trigger option's markup, and no call
 * does both. Spelled as one optional bag the illegal states were representable — `{}` wrote
 * `@[]()` into the document, and `{option, value}` typechecked while silently dropping `value`.
 *
 * The `?: never` members are load-bearing: a bare union does NOT forbid `{option, value}`,
 * because excess-property checking against a union accepts any key declared by ANY arm.
 */
export type OverlayPick =
	| {option: CoreOption; value?: never; meta?: never}
	| {option?: never; value: string; meta?: string}

/**
 * A row of the built-in Suggestions overlay. A bare string is label and value at once, which is
 * every list whose text IS what the document stores; the object form separates them, so a row can
 * carry the identity that goes in the `__meta__` gap of `@[__value__](__meta__)` and a `label`
 * that is neither. Without it any list with an id behind it had to drop the built-in overlay and
 * write its own component.
 */
export type Suggestion = string | {value: string; meta?: string; label?: string}

/** A row KIND's declaration: what an option adds to make its markup a row rather than a mark. */
export interface RowSpec {
	/**
	 * REQUIRED. Every row kind renders through its own component; `slots.paragraph` is the row
	 * with no kind, and the only fallback left.
	 */
	Component: Slot
	/**
	 * WHAT THE ROW A SPLIT PRODUCES IS. `true` is this kind again, AND the same `meta` — a list item
	 * continues, a checked to-do splits into two checked to-dos. `false` or absent is a plain row,
	 * which is what a heading wants.
	 *
	 * AN OPTION IS A THIRD ANSWER: the tail takes THAT kind, carrying no `meta` of this one's. A
	 * table HEADER is the shape that needs it — it continues into a table LINE, not into a second
	 * header and not into a paragraph, and without it the obvious way to add the first data row
	 * (Enter, then type the cells) left a paragraph holding literal pipes. The option must be one
	 * this editor compiled a row kind from, exactly as {@link split}'s `as` must; anything else
	 * continues into a plain row.
	 *
	 * ONE field for the whole rule, and it is the same one Enter at a row's end reads: "another row
	 * of this kind" and "the tail keeps this kind" are the same question asked at two caret
	 * positions.
	 */
	continues?: boolean | CoreOption
	/**
	 * Does Tab / Shift+Tab re-indent a row of this kind, and does Tab belong to the editor at all
	 * while the caret is in one. Default false, so Tab still LEAVES THE FIELD everywhere else —
	 * ADR-0002's accepted cost, preserved rather than traded for a keyboard trap.
	 *
	 * It gates the KEY, not the verb: a kind that declares it consumes Tab even where the depth
	 * cannot change, because a Tab that sometimes moves focus and sometimes indents is worse than
	 * either.
	 */
	indents?: boolean
	/**
	 * This kind carves its OWN body at a literal, and each piece becomes an ordinary Row of the
	 * option `as` names — a table line into cells. A cell is not a node kind of its own: it is a Row
	 * whose structural bytes are the delimiter it was carved at, so it renders through its option's
	 * component, holds ordinary inline marks, and round-trips by concatenation.
	 *
	 * `as` may be an option with NO markup at all — an anonymous kind, which nothing scans and which
	 * exists only as a split's target. It must be an option of this editor carrying `row`; anything
	 * else is reported and this kind carves nothing.
	 *
	 * A carved row takes no indent-nested children: its children ARE its body. Tab inside one walks
	 * to the next piece rather than changing depth, and a piece cannot contain the delimiter — an
	 * escape scoped to a cell's body is the named follow-up.
	 */
	split?: {at: string; as: CoreOption}
}

export type OverlayMatch<TOption = CoreOption> = {
	/**
	 * Found value via a overlayMatch
	 */
	value: string
	/**
	 * Triggered value
	 */
	source: string
	/**
	 * Piece of text, in which was a overlayMatch — the caret's own text node, not the whole value
	 */
	span: string
	/**
	 * Html element, in which was a overlayMatch
	 */
	node: Node
	/**
	 * The span the accepted suggestion replaces, as NODE ANCHORS (spec S2 §4.5). It was a
	 * `{start, end}` offset pair until S2.5; both adapters pass it straight back into
	 * `overlay.choose()` without reading it, so this is a type change and not a logic one —
	 * verified across `packages/{react,vue}/markput/src` and `packages/storybook/src`, where
	 * the only field any consumer touches is `match.value`.
	 */
	range: Anchors
	/**
	 * OverlayMatch's option
	 */
	option: TOption
}

export type OverlayTrigger = Array<'change' | 'selectionChange'> | 'change' | 'selectionChange' | 'none'

export type CSSProperties = CSS.Properties<string | number>
export type DataAttributes = Record<`data${Capitalize<string>}`, string | number | boolean | undefined>

/**
 * THE slot key set, and both adapters extend it rather than restating it.
 *
 * A value is a framework component OR an intrinsic tag NAME. The string half is not a convenience:
 * `resolveSlot`'s `defaultSlots` is a `Record<SlotName, string>`, so every slot a consumer leaves
 * unset resolves to one, and `Slots.spec`'s `{container: 'article'}` mounts in both adapters.
 */
export interface CoreSlots {
	container?: Slot | string
	/** The component a row with NO kind renders through. A kind brings its own, so this is never asked for one. */
	paragraph?: Slot | string
}

/** THE slot-props key set — NOT the same list as {@link CoreSlots}, and both adapters extend it. */
export interface CoreSlotProps {
	container?: Record<string, unknown> & {className?: string; style?: CSSProperties}
	/** Merged onto EVERY row's wrapper — kind or paragraph alike, unlike `slots.paragraph`. */
	row?: Record<string, unknown> & {className?: string; style?: CSSProperties}
}

export interface DraggableConfig {
	/**
	 * Keep the drag grip visible instead of fading it in on hover.
	 *
	 * ONE grip, on the row nearest the pointer — resting on the first row while the pointer is
	 * away from the editor. It used to mean a grip on every row; the editor paints the row
	 * controls from one layer now, and one layer shows one grip.
	 */
	alwaysShowHandle?: boolean
}