import type {Range} from '../../shared/editorContracts'
import {computed, event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {CaretModel} from '../caret/CaretModel'
import {createRowContent} from '../editing'
import type {Token} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import type {PropsModel} from '../props/PropsModel'
import type {ValueModel} from '../value/ValueModel'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class DragController {
	readonly action = event<DragAction>()

	#unsub?: () => void

	constructor(
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly parsing: ParseController,
		private readonly caret: CaretModel
	) {
		const isDragEnabled = computed(() => this.props.layout() === 'block' && !!this.props.draggable())

		const toggle = (enabled: boolean) => {
			if (enabled && !this.#unsub) {
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
			if (!enabled && this.#unsub) {
				this.#unsub()
				this.#unsub = undefined
			}
		}

		watch(isDragEnabled, toggle)
		toggle(isDragEnabled())
	}

	#reorder(action: Extract<DragAction, {type: 'reorder'}>) {
		const value = this.value.current()
		const rows = this.parsing.tokens()
		const newValue = reorderDragRows(value, rows, action.source, action.target)
		if (newValue !== value) {
			const range = this.#rangeAfterDrag(action, rows, newValue)
			if (range) this.caret.selection(range)
			this.value.current(newValue)
		}
	}

	#add(action: Extract<DragAction, {type: 'add'}>) {
		const value = this.value.current()
		const rawRows = this.parsing.tokens()
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		const newRowContent = createRowContent(this.props.options())
		const newValue = addDragRow(value, rows, action.afterIndex, newRowContent)
		const range = this.#rangeAfterDrag(action, rows, newValue)
		if (range) this.caret.selection(range)
		this.value.current(newValue)
	}

	#delete(action: Extract<DragAction, {type: 'delete'}>) {
		const value = this.value.current()
		const rows = this.parsing.tokens()
		const newValue = deleteDragRow(value, rows, action.index)
		const range = this.#rangeAfterDrag(action, rows, newValue)
		if (range) this.caret.selection(range)
		this.value.current(newValue)
	}

	#duplicate(action: Extract<DragAction, {type: 'duplicate'}>) {
		const value = this.value.current()
		const rows = this.parsing.tokens()
		const newValue = duplicateDragRow(value, rows, action.index)
		const range = this.#rangeAfterDrag(action, rows, newValue)
		if (range) this.caret.selection(range)
		this.value.current(newValue)
	}

	#rangeAfterDrag(action: DragAction, previousRows: readonly Token[], nextValue: string): Range | undefined {
		let rawPosition: number | undefined
		if (action.type === 'add') {
			const after = previousRows.at(action.afterIndex)
			rawPosition = after ? after.position.end : nextValue.length
		} else if (action.type === 'duplicate') {
			const row = previousRows.at(action.index)
			rawPosition = row ? row.position.end : undefined
		} else if (action.type === 'delete') {
			const next =
				previousRows.at(action.index + 1) ?? (action.index > 0 ? previousRows.at(action.index - 1) : undefined)
			rawPosition = next ? Math.min(next.position.start, nextValue.length) : 0
		} else {
			const moved = previousRows.at(action.source)
			rawPosition = moved ? Math.min(moved.position.start, nextValue.length) : undefined
		}
		return rawPosition !== undefined ? {start: rawPosition, end: rawPosition} : undefined
	}
}