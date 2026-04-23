import {childAt} from '../../shared/checkers'
import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {Store} from '../../store/Store'
import {createRowContent} from '../editing'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class DragFeature {
	readonly state = {} as const
	readonly computed = {} as const
	readonly emit = {
		drag: event<DragAction>(),
	}

	constructor(private readonly store: Store) {}

	#unsub?: () => void

	enable() {
		if (this.#unsub) return

		this.#unsub = watch(this.emit.drag, action => {
			switch (action.type) {
				case 'reorder':
					this.#reorder(action.source, action.target)
					break
				case 'add':
					this.#add(action.afterIndex)
					break
				case 'delete':
					this.#delete(action.index)
					break
				case 'duplicate':
					this.#duplicate(action.index)
					break
			}
		})
	}

	disable() {
		this.#unsub?.()
		this.#unsub = undefined
	}

	#reorder(sourceIndex: number, targetIndex: number) {
		const value = this.store.props.value()
		if (value == null || !this.store.props.onChange()) return
		const rows = this.store.state.tokens()
		const newValue = reorderDragRows(value, rows, sourceIndex, targetIndex)
		if (newValue !== value) this.store.feature.value.state.innerValue(newValue)
	}

	#add(afterIndex: number) {
		const value = this.store.props.value()
		if (value == null || !this.store.props.onChange()) return
		const rawRows = this.store.state.tokens()
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		const newRowContent = createRowContent(this.store.props.options())
		this.store.feature.value.state.innerValue(addDragRow(value, rows, afterIndex, newRowContent))
		queueMicrotask(() => {
			const container = this.store.state.container()
			if (!container) return
			const target = childAt(container, afterIndex + 1)
			target?.focus()
		})
	}

	#delete(index: number) {
		const value = this.store.props.value()
		if (value == null || !this.store.props.onChange()) return
		const rows = this.store.state.tokens()
		this.store.feature.value.state.innerValue(deleteDragRow(value, rows, index))
	}

	#duplicate(index: number) {
		const value = this.store.props.value()
		if (value == null || !this.store.props.onChange()) return
		const rows = this.store.state.tokens()
		this.store.feature.value.state.innerValue(duplicateDragRow(value, rows, index))
	}
}