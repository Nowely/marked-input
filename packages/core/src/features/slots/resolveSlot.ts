import type {CoreOption, CoreSlotProps, CoreSlots, RowSpec, Slot} from '../../shared/types'
import {cx} from '../../shared/utils/cx'
import {convertDataAttrs} from '../../shared/utils/dataAttributes'
import type {TreeNode} from '../tokens'

import styles from '../../../styles.module.css'

function resolveOptionSlot<T extends object>(optionConfig: T | ((base: T) => T) | undefined, baseProps: T): T {
	if (optionConfig !== undefined) {
		return typeof optionConfig === 'function' ? optionConfig(baseProps) : optionConfig
	}
	return baseProps
}

export type SlotName = 'container' | 'block'

const defaultSlots: Record<SlotName, string> = {
	container: 'div',
	block: 'div',
}

export function resolveSlot(slotName: SlotName, slots: unknown): Slot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- `slots` is `CoreSlots | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
	return ((slots as CoreSlots | undefined)?.[slotName] ?? defaultSlots[slotName]) as Slot
}

export function resolveSlotProps(slotName: SlotName, slotProps: unknown): Record<string, unknown> | undefined {
	// oxlint-disable-next-line no-unsafe-type-assertion -- `slotProps` is `CoreSlotProps | undefined` at runtime; typed as unknown for Vue Ref<T> cross-framework compat
	const props = (slotProps as CoreSlotProps | undefined)?.[slotName]
	return props ? convertDataAttrs(props) : undefined
}

type SlotProp = Record<string, unknown> | ((base: Record<string, unknown>) => Record<string, unknown>)

/**
 * Internal view of a framework-specific Option for slot resolution.
 * Framework Option types (React, Vue) extend CoreOption with these properties.
 */
export interface SlotOption extends Omit<CoreOption, 'overlay' | 'row'> {
	row?: {Component?: Slot} & Omit<RowSpec, 'Component'>
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
 * THE node's framework component and props — for text, mark and ROW alike. Reads the node's
 * signals, and its callers are render bodies rather than reactive scopes, so nothing subscribes
 * here; the subscription that makes a node repaint is the component's own (spec D8).
 *
 * A ROW resolves through its KIND's component, and a row with no kind — a paragraph — through
 * `slots.block`, which is the only fallback left. It answers the `className`/`style` merge with
 * it: both adapters used to cast and merge those by hand beside their own `blockComponent` and
 * `blockProps` reads, which was one rule written twice.
 */
export function resolveNodeSlot(node: TreeNode, ctx: NodeSlotContext): readonly [Slot, Record<string, unknown>] {
	if (node.kind === 'text') {
		const fallback = (ctx.Span ?? 'span') as Slot
		return [fallback, ctx.Span ? {value: node.text()} : {}]
	}
	if (node.kind === 'row') {
		const option = node.option()
		const Kind = option === undefined ? undefined : ctx.options?.[option]?.row?.Component
		const {className, style, ...rest} = resolveSlotProps('block', ctx.slotProps) ?? {}
		// oxlint-disable-next-line no-unsafe-type-assertion -- slotProps.className is raw consumer input
		const base = {...rest, className: cx(styles.Block, className as string | undefined), style}
		// The row's own data goes ONLY to a kind's component, which is the consumer's. The
		// paragraph fallback is `slots.block`, whose default is a bare `div`: handing a `node`
		// to that writes a stringified attribute onto the element.
		return Kind ? [Kind, {...base, meta: node.meta(), node}] : [resolveSlot('block', ctx.slots), base]
	}
	const option = ctx.options?.[node.descriptor.index]
	const baseProps = {value: node.value(), meta: node.meta()}
	const props = resolveOptionSlot(option?.mark, baseProps)
	const Component = option?.Mark ?? ctx.Mark
	if (!Component) throw new Error('No mark component found. Provide either option.Mark or global Mark.')
	return [Component, props]
}