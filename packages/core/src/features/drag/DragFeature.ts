import {childAt} from '../../shared/checkers'
import {watch} from '../../shared/signals'
import type {Store} from '../../store/Store'
import {createRowContent} from '../editing'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class DragFeature {
	constructor(private store: Store) {}

	#unsub?: () => void

	enable() {
		if (this.#unsub) return

		this.#unsub = watch(this.store.event.dragAction, action => {
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
		if (newValue !== value) this.store.state.innerValue(newValue)
	}

	#add(afterIndex: number) {
		const value = this.store.props.value()
		if (value == null || !this.store.props.onChange()) return
		const rawRows = this.store.state.tokens()
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		const newRowContent = createRowContent(this.store.props.options())
		this.store.state.innerValue(addDragRow(value, rows, afterIndex, newRowContent))
		queueMicrotask(() => {
			const container = this.store.refs.container
			if (!container) return
			const target = childAt(container, afterIndex + 1)
			target?.focus()
		})
	}

	#delete(index: number) {
		const value = this.store.props.value()
		if (value == null || !this.store.props.onChange()) return
		const rows = this.store.state.tokens()
		this.store.state.innerValue(deleteDragRow(value, rows, index))
	}

	#duplicate(index: number) {
		const value = this.store.props.value()
		if (value == null || !this.store.props.onChange()) return
		const rows = this.store.state.tokens()
		this.store.state.innerValue(duplicateDragRow(value, rows, index))
	}
}