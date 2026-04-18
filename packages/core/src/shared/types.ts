import type * as CSS from 'csstype'

import type {Parser, Token} from '../features/parsing'
import type {Markup} from '../features/parsing/parser/types'
import type {NodeProxy} from './classes/NodeProxy'

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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SlotRegistry {}

/** Framework-provided component type. Resolves to `unknown` unless `SlotRegistry` is augmented. */
export type Slot = keyof SlotRegistry extends never ? unknown : SlotRegistry[keyof SlotRegistry]

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
	Span: Slot
	Mark: Slot
	Overlay: Slot
	className: string | undefined
	style: CSSProperties | undefined
	slots: CoreSlots | undefined
	slotProps: CoreSlotProps | undefined
	layout: 'inline' | 'block'
	draggable: boolean | DraggableConfig
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

export interface CoreSlots {
	container?: Slot
	block?: Slot
	span?: Slot
}

export interface CoreSlotProps {
	container?: Record<string, unknown> & {className?: string; style?: CSSProperties}
	block?: Record<string, unknown> & {className?: string; style?: CSSProperties}
	span?: Record<string, unknown> & {className?: string; style?: CSSProperties}
}

export interface DraggableConfig {
	alwaysShowHandle?: boolean
}

export type DragAction =
	| {type: 'reorder'; source: number; target: number}
	| {type: 'add'; afterIndex: number}
	| {type: 'delete'; index: number}
	| {type: 'duplicate'; index: number}

export interface DragActions {
	dragAction: {(action: DragAction): void}
}