import {signal, computed} from '../../shared/signals/index.js'
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
	readonly state = {
		container: signal<HTMLDivElement | null>(null),
	}

	readonly computed: {
		isBlock: Computed<boolean>
		isDraggable: Computed<boolean>
		containerComponent: Computed<Slot>
		containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}>
		blockComponent: Computed<Slot>
		blockProps: Computed<Record<string, unknown> | undefined>
		spanComponent: Computed<Slot>
		spanProps: Computed<Record<string, unknown> | undefined>
	} = {
		isBlock: computed(() => this._store.props.layout() === 'block'),
		isDraggable: computed(() => !!this._store.props.draggable()),
		containerComponent: computed(() => resolveSlot('container', this._store.props.slots())),
		containerProps: computed(
			() =>
				buildContainerProps(
					this.computed.isDraggable() && this.computed.isBlock(),
					this._store.props.readOnly(),
					this._store.props.className(),
					this._store.props.style(),
					this._store.props.slotProps()
				),
			{equals: shallow}
		),
		blockComponent: computed(() => resolveSlot('block', this._store.props.slots())),
		blockProps: computed(() => resolveSlotProps('block', this._store.props.slotProps())),
		spanComponent: computed(() => resolveSlot('span', this._store.props.slots())),
		spanProps: computed(() => resolveSlotProps('span', this._store.props.slotProps())),
	}

	readonly emit = {} as const

	constructor(private readonly _store: Store) {}
	enable() {}
	disable() {}
}