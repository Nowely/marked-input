import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from '../blocks/dragOperations'
import {EMPTY_TEXT_TOKEN, filterDragTokens} from '../blocks/splitTokensIntoDragRows'
import type {Store} from '../store/Store'

export class DragController {
	constructor(private store: Store) {}

	enable() {}
	disable() {}

	reorder(sourceIndex: number, targetIndex: number) {
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rows = filterDragTokens(this.store.state.tokens.get())
		const newValue = reorderDragRows(value, rows, sourceIndex, targetIndex)
		if (newValue !== value) this.store.applyValue(newValue)
	}

	add(afterIndex: number) {
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rawRows = filterDragTokens(this.store.state.tokens.get())
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		this.store.applyValue(addDragRow(value, rows, afterIndex))
		queueMicrotask(() => {
			const container = this.store.refs.container
			if (!container) return
			const target = container.children[afterIndex + 1] as HTMLElement | undefined
			target?.focus()
		})
	}

	delete(index: number) {
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rows = filterDragTokens(this.store.state.tokens.get())
		this.store.applyValue(deleteDragRow(value, rows, index))
	}

	duplicate(index: number) {
		const value = this.store.state.value.get()
		if (value == null || !this.store.state.onChange.get()) return
		const rows = filterDragTokens(this.store.state.tokens.get())
		this.store.applyValue(duplicateDragRow(value, rows, index))
	}
}