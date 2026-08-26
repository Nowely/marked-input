import type {CoreOption, CoreSlotProps, CoreSlots, Slot} from '../../shared/types'
import {cx} from '../../shared/utils/cx'
import {convertDataAttrs} from '../../shared/utils/dataAttributes'
import type {RowNode, TreeNode} from '../tokens'

import styles from '../../../styles.module.css'

function resolveOptionSlot<T extends object>(optionConfig: T | ((base: T) => T) | undefined, baseProps: T): T {
	if (optionConfig !== undefined) {
		return typeof optionConfig === 'function' ? optionConfig(baseProps) : optionConfig
	}
	return baseProps
}

// The two key sets are NOT the same list, and naming them apart is the point: `slots.paragraph`
// is consulted only for a row with no kind, while `slotProps.row` reaches every row.
export type SlotName = keyof CoreSlots
export type SlotPropsName = keyof CoreSlotProps

const defaultSlots: Record<SlotName, string> = {
	container: 'div',
	paragraph: 'div',
}

export function resolveSlot(slotName: SlotName, slots: unknown): Slot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- `slots` is `CoreSlots | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
	return ((slots as CoreSlots | undefined)?.[slotName] ?? defaultSlots[slotName]) as Slot
}

export function resolveSlotProps(slotName: SlotPropsName, slotProps: unknown): Record<string, unknown> | undefined {
	// oxlint-disable-next-line no-unsafe-type-assertion -- `slotProps` is `CoreSlotProps | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
	const props = (slotProps as CoreSlotProps | undefined)?.[slotName]
	return props ? convertDataAttrs(props) : undefined
}

type SlotProp = Record<string, unknown> | ((base: Record<string, unknown>) => Record<string, unknown>)

/**
 * Internal view of a framework-specific Option for slot resolution.
 * Framework Option types (React, Vue) extend CoreOption with these properties.
 */
export interface SlotOption extends Omit<CoreOption, 'overlay'> {
	Mark?: Slot
	mark?: SlotProp
	Overlay?: Slot
	overlay?: SlotProp
}

export function resolveOverlaySlot(
	globalComponent: Slot | undefined,
	option?: SlotOption,
	defaultComponent?: Slot
): readonly [Slot, Record<string, unknown>] {
	const Component = option?.Overlay ?? globalComponent ?? defaultComponent
	if (!Component)
		throw new Error(
			'No overlay component found. Provide either option.Overlay, global Overlay, or a defaultComponent.'
		)
	const props = resolveOptionSlot<Record<string, unknown>>(option?.overlay, {})
	return [Component, props]
}

/** Everything the resolution below reads that is not the node itself. */
export interface NodeSlotContext {
	options: SlotOption[] | undefined
	Mark: Slot | undefined
	Span: Slot | undefined
	/** `CoreSlots | undefined` at runtime; `unknown` for Vue `Ref<T>` cross-framework compat. */
	slots: unknown
	/** `CoreSlotProps | undefined` at runtime, same reason. */
	slotProps: unknown
}

/**
 * What only the parent that MAPPED a row knows, and the tree therefore cannot answer: the row's
 * place among its siblings.
 *
 * The RENDERED CHILD ROWS are deliberately not here. They are framework values with no use in
 * core — it ships no components — and routing them through would put an `unknown` on this
 * interface for a spread straight back out. Each adapter hands them to the kind itself, off the
 * same `'node' in props` test core already answers below.
 */
export interface RowRender {
	depth: number
	index: number
}

/**
 * THE node's framework component and props — for text, mark and ROW alike. Reads the node's
 * signals, and its callers are render bodies rather than reactive scopes, so nothing subscribes
 * here; the subscription that makes a node repaint is the component's own (spec D8).
 *
 * A ROW resolves through its KIND's component, and a row with no kind — a paragraph — through
 * `slots.paragraph`, which is the only fallback left. It answers the `className`/`style` merge
 * with it: both adapters used to cast and merge those by hand beside their own row component and
 * row props reads, which was one rule written twice.
 */
export function resolveNodeSlot(
	node: TreeNode,
	ctx: NodeSlotContext,
	row?: RowRender
): readonly [Slot, Record<string, unknown>] {
	if (node.kind === 'text') {
		const fallback = (ctx.Span ?? 'span') as Slot
		return [fallback, ctx.Span ? {value: node.text()} : {}]
	}
	if (node.kind === 'row') {
		const Kind = rowComponent(node, ctx)
		const {className, style, ...rest} = resolveSlotProps('row', ctx.slotProps) ?? {}
		// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.className is raw consumer input
		const base = {...rest, className: cx(styles.Row, className as string | undefined), style}
		// The row's own data goes ONLY to a kind's component, which is the consumer's. The
		// paragraph fallback is `slots.paragraph`, whose default is a bare `div`: handing a `node`
		// to that writes a stringified attribute onto the element — and the same is true of the
		// rendered child rows, which is why a paragraph's go in as ordinary children instead.
		//
		// `node` in the returned props is therefore also THE test a caller reads for "this row
		// paints through its kind's own component"; both adapters ask it that way.
		return Kind ? [Kind, {...base, meta: node.meta(), node, ...row}] : [resolveSlot('paragraph', ctx.slots), base]
	}
	const option = ctx.options?.[node.descriptor.index]
	const baseProps = {value: node.value(), meta: node.meta()}
	const props = resolveOptionSlot(option?.mark, baseProps)
	const Component = option?.Mark ?? ctx.Mark
	if (!Component) throw new Error('No mark component found. Provide either option.Mark or global Mark.')
	return [Component, props]
}

/** The component a row's KIND declares, or `undefined` for a paragraph. */
function rowComponent(node: RowNode, ctx: NodeSlotContext): Slot | undefined {
	const option = node.option()
	return option === undefined ? undefined : ctx.options?.[option]?.row?.Component
}