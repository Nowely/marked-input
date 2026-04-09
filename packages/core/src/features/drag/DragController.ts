import {childAt} from '../../shared/checkers'
import {watch} from '../../shared/signals'
import {createRowContent} from '../editing'
import type {Store} from '../store/Store'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class DragController {
	constructor(private store: Store) {}

	#unsub?: () => void

	enable() {
		this.#unsub = watch(this.store.events.dragAction, action => {
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
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rows = this.store.state.tokens.get()
		const newValue = reorderDragRows(value, rows, sourceIndex, targetIndex)
		if (newValue !== value) this.store.state.innerValue.set(newValue)
	}

	#add(afterIndex: number) {
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rawRows = this.store.state.tokens.get()
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		const newRowContent = createRowContent(this.store.state.options.get())
		this.store.state.innerValue.set(addDragRow(value, rows, afterIndex, newRowContent))
		queueMicrotask(() => {
			const container = this.store.refs.container
			if (!container) return
			const target = childAt(container, afterIndex + 1)
			target?.focus()
		})
	}

	#delete(index: number) {
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rows = this.store.state.tokens.get()
		this.store.state.innerValue.set(deleteDragRow(value, rows, index))
	}

	#duplicate(index: number) {
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rows = this.store.state.tokens.get()
		this.store.state.innerValue.set(duplicateDragRow(value, rows, index))
	}
}