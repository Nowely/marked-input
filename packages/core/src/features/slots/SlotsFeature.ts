import {computed} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CSSProperties, CoreSlotProps, Feature, Slot} from '../../shared/types'
import {cx} from '../../shared/utils/cx'
import {merge} from '../../shared/utils/merge'
import {shallow} from '../../shared/utils/shallow'
import type {Store} from '../../store/Store'
import {resolveSlot, resolveSlotProps} from './resolveSlot'

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

export class SlotsFeature implements Feature {
	readonly isBlock: Computed<boolean> = computed(() => this._store.props.layout() === 'block')
	readonly isDraggable: Computed<boolean> = computed(() => !!this._store.props.draggable())
	readonly containerComponent: Computed<Slot> = computed(() => resolveSlot('container', this._store.props.slots()))
	readonly containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}> =
		computed(
			() =>
				buildContainerProps(
					this.isDraggable() && this.isBlock(),
					this._store.props.readOnly(),
					this._store.props.className(),
					this._store.props.style(),
					this._store.props.slotProps()
				),
			{equals: shallow}
		)
	readonly blockComponent: Computed<Slot> = computed(() => resolveSlot('block', this._store.props.slots()))
	readonly blockProps: Computed<Record<string, unknown> | undefined> = computed(() =>
		resolveSlotProps('block', this._store.props.slotProps())
	)
	readonly spanComponent: Computed<Slot> = computed(() => resolveSlot('span', this._store.props.slots()))
	readonly spanProps: Computed<Record<string, unknown> | undefined> = computed(() =>
		resolveSlotProps('span', this._store.props.slotProps())
	)

	constructor(private readonly _store: Store) {}
	enable() {}
	disable() {}
}