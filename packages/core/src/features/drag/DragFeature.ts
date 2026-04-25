import type {CaretRecovery} from '../../shared/editorContracts'
import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {Store} from '../../store/Store'
import {createRowContent} from '../editing'
import type {Token} from '../parsing'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class DragFeature {
	readonly action = event<DragAction>()

	constructor(private readonly store: Store) {}

	#unsub?: () => void

	enable() {
		if (this.#unsub) return

		this.#unsub = watch(this.action, action => {
			switch (action.type) {
				case 'reorder':
					this.#reorder(action)
					break
				case 'add':
					this.#add(action)
					break
				case 'delete':
					this.#delete(action)
					break
				case 'duplicate':
					this.#duplicate(action)
					break
			}
		})
	}

	disable() {
		this.#unsub?.()
		this.#unsub = undefined
	}

	#reorder(action: Extract<DragAction, {type: 'reorder'}>) {
		const value = this.store.value.current()
		const rows = this.store.parsing.tokens()
		const newValue = reorderDragRows(value, rows, action.source, action.target)
		if (newValue !== value) {
			this.store.value.replaceAll(newValue, {
				source: 'drag',
				recover: this.#recoverAfterDrag(action, rows, newValue),
			})
		}
	}

	#add(action: Extract<DragAction, {type: 'add'}>) {
		const value = this.store.value.current()
		const rawRows = this.store.parsing.tokens()
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		const newRowContent = createRowContent(this.store.props.options())
		const newValue = addDragRow(value, rows, action.afterIndex, newRowContent)
		this.store.value.replaceAll(newValue, {
			source: 'drag',
			recover: this.#recoverAfterDrag(action, rows, newValue),
		})
	}

	#delete(action: Extract<DragAction, {type: 'delete'}>) {
		const value = this.store.value.current()
		const rows = this.store.parsing.tokens()
		const newValue = deleteDragRow(value, rows, action.index)
		this.store.value.replaceAll(newValue, {
			source: 'drag',
			recover: this.#recoverAfterDrag(action, rows, newValue),
		})
	}

	#duplicate(action: Extract<DragAction, {type: 'duplicate'}>) {
		const value = this.store.value.current()
		const rows = this.store.parsing.tokens()
		const newValue = duplicateDragRow(value, rows, action.index)
		this.store.value.replaceAll(newValue, {
			source: 'drag',
			recover: this.#recoverAfterDrag(action, rows, newValue),
		})
	}

	#recoverAfterDrag(
		action: DragAction,
		previousRows: readonly Token[],
		nextValue: string
	): CaretRecovery | undefined {
		if (action.type === 'add') {
			const after = previousRows.at(action.afterIndex)
			const rawPosition = after ? after.position.end : nextValue.length
			return {kind: 'caret', rawPosition}
		}
		if (action.type === 'duplicate') {
			const row = previousRows.at(action.index)
			return row ? {kind: 'caret', rawPosition: row.position.end} : undefined
		}
		if (action.type === 'delete') {
			const next =
				previousRows.at(action.index + 1) ?? (action.index > 0 ? previousRows.at(action.index - 1) : undefined)
			return next
				? {kind: 'caret', rawPosition: Math.min(next.position.start, nextValue.length)}
				: {kind: 'caret', rawPosition: 0}
		}
		const moved = previousRows.at(action.source)
		return moved ? {kind: 'caret', rawPosition: Math.min(moved.position.start, nextValue.length)} : undefined
	}
}