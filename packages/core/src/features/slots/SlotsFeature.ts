import {computed} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CSSProperties, CoreSlotProps, Slot} from '../../shared/types'
import {cx} from '../../shared/utils/cx'
import {merge} from '../../shared/utils/merge'
import {shallow} from '../../shared/utils/shallow'
import type {PropsModel} from '../state/PropsModel'
import type {TokenModel, TreeNode} from '../tokens'
import {resolveNodeSlot, resolveSlot, resolveSlotProps} from './resolveSlot'
import type {RowRender} from './resolveSlot'
import type {NodeSlot} from './types'

import styles from '../../../styles.module.css'

/**
 * The ROW GUTTER: the strip left of every row that the controls layer paints into, as a
 * CSS-READY STRING rather than the bare number it was.
 *
 * TWO CONTROLS WIDE, and that is what it is measured against — the band holds an insert button and
 * the grip, at 24px each. It was one grip wide while the grip was the only thing in it.
 *
 * `containerProps().style` is one bag handed to two frameworks that disagree about a number:
 * React's JSX appends `px` for a length property, Vue assigns the value to `element.style`
 * verbatim and the CSSOM REJECTS an unitless length — so in Vue the gutter never existed and
 * every `draggable: true` editor laid out as if it were `false` (measured: computed
 * `padding-left` 24px in React, 0px in Vue, with no `style` attribute written at all). Core is
 * framework-agnostic, so the only value it may emit is one that needs no framework's
 * convention to become CSS.
 */
const ROW_GUTTER_WIDTH = '48px'

function buildContainerProps(
	rowsDraggable: boolean,
	readOnly: boolean,
	className: string | undefined,
	style: CSSProperties | undefined,
	slotProps: CoreSlotProps | undefined
): {className: string | undefined; style?: CSSProperties; [key: string]: unknown} {
	const containerSlotProps = slotProps?.container
	const baseStyle = merge(style, containerSlotProps?.style)
	const mergedStyle = rowsDraggable && !readOnly ? {paddingLeft: ROW_GUTTER_WIDTH, ...baseStyle} : baseStyle

	const {className: _, style: __, ...otherSlotProps} = resolveSlotProps('container', slotProps) ?? {}

	return {
		className: cx(styles.Container, className, containerSlotProps?.className),
		style: mergedStyle,
		...otherSlotProps,
	}
}

export class SlotsFeature {
	readonly containerComponent: Computed<Slot> = computed(() => resolveSlot('container', this.props.slots()))
	readonly containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}> =
		computed(
			() =>
				buildContainerProps(
					this.tokens.rowConfig() !== undefined && !!this.props.draggable(),
					this.props.readOnly(),
					this.props.className(),
					this.props.style(),
					this.props.slotProps()
				),
			{equals: shallow}
		)
	/**
	 * THE node resolver, for every node kind. A separate row component/props pair used to sit
	 * beside it and answer the row half; both are gone — a row is a node, and `resolveNodeSlot`
	 * answers it exactly as it answers a mark.
	 */
	readonly node: NodeSlot = computed(() => {
		const ctx = {
			options: this.props.options(),
			Mark: this.props.Mark(),
			Span: this.props.Span(),
			slots: this.props.slots(),
			slotProps: this.props.slotProps(),
		}
		return (node: TreeNode, row?: RowRender) => resolveNodeSlot(node, ctx, row)
	})

	// `tokens` is here for `rowConfig` alone, and only its PROPS-derived half is wanted:
	// `containerProps` is read during server rendering, where no container has attached and the
	// tree is still empty, so a gutter asked of the rows would vanish from the SSR pass.
	constructor(
		private readonly props: PropsModel,
		private readonly tokens: TokenModel
	) {}
}