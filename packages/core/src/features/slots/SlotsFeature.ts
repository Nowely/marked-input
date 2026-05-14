import {computed} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CSSProperties, CoreSlotProps, Slot} from '../../shared/types'
import {cx} from '../../shared/utils/cx'
import {merge} from '../../shared/utils/merge'
import {shallow} from '../../shared/utils/shallow'
import type {Token} from '../parsing'
import type {PropsModel} from '../state/PropsModel'
import {resolveMarkSlot, resolveSlot, resolveSlotProps} from './resolveSlot'
import type {MarkSlot} from './types'

import styles from '../../../styles.module.css'

const DRAG_HANDLE_WIDTH = 24

function buildContainerProps(
	isDraggableBlock: boolean,
	readOnly: boolean,
	className: string | undefined,
	style: CSSProperties | undefined,
	slotProps: CoreSlotProps | undefined
): {className: string | undefined; style?: CSSProperties; [key: string]: unknown} {
	const containerSlotProps = slotProps?.container
	const baseStyle = merge(style, containerSlotProps?.style)
	const mergedStyle = isDraggableBlock && !readOnly ? {paddingLeft: DRAG_HANDLE_WIDTH, ...baseStyle} : baseStyle

	const {className: _, style: __, ...otherSlotProps} = resolveSlotProps('container', slotProps) ?? {}

	return {
		className: cx(styles.Container, className, containerSlotProps?.className),
		style: mergedStyle,
		...otherSlotProps,
	}
}

export class SlotsFeature {
	readonly isBlock: Computed<boolean> = computed(() => this.props.layout() === 'block')
	readonly isDragEnabled: Computed<boolean> = computed(
		() => this.props.layout() === 'block' && !!this.props.draggable()
	)
	readonly containerComponent: Computed<Slot> = computed(() => resolveSlot('container', this.props.slots()))
	readonly containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}> =
		computed(
			() =>
				buildContainerProps(
					this.isDragEnabled(),
					this.props.readOnly(),
					this.props.className(),
					this.props.style(),
					this.props.slotProps()
				),
			{equals: shallow}
		)
	readonly blockComponent: Computed<Slot> = computed(() => resolveSlot('block', this.props.slots()))
	readonly blockProps: Computed<Record<string, unknown> | undefined> = computed(() =>
		resolveSlotProps('block', this.props.slotProps())
	)
	readonly mark: MarkSlot = computed(() => {
		const options = this.props.options()
		const Mark = this.props.Mark()
		const Span = this.props.Span()
		return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
	})

	constructor(private readonly props: PropsModel) {}
}