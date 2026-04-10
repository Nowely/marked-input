import type * as CSS from 'csstype'

import type {Parser, Token} from '../features/parsing'
import type {Markup} from '../features/parsing/parser/types'
import type {NodeProxy} from './classes/NodeProxy'

/**
 * Core option for markups - Framework-agnostic configuration.
 * Extended by framework-specific Option types (e.g., React Option).
 *
 * Architecture:
 * - CoreOption: Contains only markup pattern (framework-independent)
 * - trigger configuration: Handled by framework layer via getTrigger function in TriggerFinder
 * - Separation of concerns: Core focuses on markup parsing, framework handles overlay triggers
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
	overlay?: {trigger?: string}
}

/**
 * State for Markput store
 * Contains internal state and props-derived configuration
 */
export interface MarkputState {
	tokens: Token[]
	parser: Parser | undefined
	previousValue: string | undefined
	recovery: Recovery | undefined
	selecting: 'drag' | 'all' | undefined
	overlayMatch: OverlayMatch | undefined
	/** Annotated text with markups for mark */
	value: string | undefined
	/** Default value */
	defaultValue: string | undefined
	/** Change event handler */
	onChange: ((value: string) => void) | undefined
	/** Prevents from changing the value */
	readOnly: boolean
	/** Configuration options for markups and overlays */
	options: CoreOption[] | undefined
	/** Events that trigger overlay display */
	showOverlayOn: OverlayTrigger | undefined
	Span: GenericComponent | undefined
	Mark: GenericComponent | undefined
	Overlay: GenericComponent | undefined
	className: string | undefined
	style: CSSProperties | undefined
	slots: CoreSlots | undefined
	slotProps: CoreSlotProps | undefined
	drag: boolean | {alwaysShowHandle: boolean}
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
	 * Piece of text, in which was a overlayMatch
	 */
	span: string
	/**
	 * Html element, in which was a overlayMatch
	 */
	node: Node
	/**
	 * Start position of a overlayMatch
	 */
	index: number
	/**
	 * OverlayMatch's option
	 */
	option: TOption
}

export type Listener<T = unknown> = (e: T) => void

// eslint-disable-next-line @typescript-eslint/no-unused-vars, oxlint-disable-next-line no-wrapper-object-types
export interface EventKey<T = unknown> extends Symbol {}

export type Recovery = {
	anchor: NodeProxy
	isNext?: boolean
	caret: number
	childIndex?: number
}

export type OverlayTrigger = Array<'change' | 'selectionChange'> | 'change' | 'selectionChange' | 'none'

export type CSSProperties = CSS.Properties<string | number>
export type DataAttributes = Record<`data${Capitalize<string>}`, string | number | boolean | undefined>

export type GenericComponent = unknown
export type GenericElement = unknown
export interface CoreSlots {
	container?: GenericElement
	block?: GenericElement
	span?: GenericElement
}

export interface CoreSlotProps {
	container?: Record<string, unknown> & {className?: string; style?: CSSProperties}
	block?: Record<string, unknown> & {className?: string; style?: CSSProperties}
	span?: Record<string, unknown> & {className?: string; style?: CSSProperties}
}

export type DragAction =
	| {type: 'reorder'; source: number; target: number}
	| {type: 'add'; afterIndex: number}
	| {type: 'delete'; index: number}
	| {type: 'duplicate'; index: number}

export interface DragActions {
	dragAction: {emit(action: DragAction): void}
}