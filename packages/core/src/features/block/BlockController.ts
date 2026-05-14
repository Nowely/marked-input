import type {Range} from '../../shared/editorContracts'
import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {Token} from '../parsing'
import type {TokenModel} from '../parsing/TokenModel'
import type {SelectionController} from '../selection/SelectionController'
import type {SlotsFeature} from '../slots/SlotsFeature'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {createRowContent} from './createRowContent'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class BlockController {
	readonly action = event<DragAction>()

	constructor(
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly tokens: TokenModel,
		private readonly selection: SelectionController,
		slots: SlotsFeature
	) {
		watch(this.action, action => {
			if (!slots.isDragEnabled()) return
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

	#reorder(action: Extract<DragAction, {type: 'reorder'}>) {
		const value = this.value.current()
		const rows = this.tokens.current()
		const newValue = reorderDragRows(value, rows, action.source, action.target)
		if (newValue !== value) {
			const range = this.#rangeAfterDrag(action, rows, newValue)
			if (range) this.selection.range(range)
			this.value.current(newValue)
		}
	}

	#add(action: Extract<DragAction, {type: 'add'}>) {
		const value = this.value.current()
		const rawRows = this.tokens.current()
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		const newRowContent = createRowContent(this.props.options())
		const newValue = addDragRow(value, rows, action.afterIndex, newRowContent)
		const range = this.#rangeAfterDrag(action, rows, newValue)
		if (range) this.selection.range(range)
		this.value.current(newValue)
	}

	#delete(action: Extract<DragAction, {type: 'delete'}>) {
		const value = this.value.current()
		const rows = this.tokens.current()
		const newValue = deleteDragRow(value, rows, action.index)
		const range = this.#rangeAfterDrag(action, rows, newValue)
		if (range) this.selection.range(range)
		this.value.current(newValue)
	}

	#duplicate(action: Extract<DragAction, {type: 'duplicate'}>) {
		const value = this.value.current()
		const rows = this.tokens.current()
		const newValue = duplicateDragRow(value, rows, action.index)
		const range = this.#rangeAfterDrag(action, rows, newValue)
		if (range) this.selection.range(range)
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