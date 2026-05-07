import type {CaretRecovery} from '../../shared/editorContracts'
import {computed, event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import {createRowContent} from '../editing'
import type {Token} from '../parsing'
import type {ParsingFeature} from '../parsing/ParseFeature'
import type {PropsFeature} from '../props/PropsFeature'
import type {ValueFeature} from '../value/ValueFeature'
import {addDragRow, deleteDragRow, duplicateDragRow, reorderDragRows} from './operations'
import {EMPTY_TEXT_TOKEN} from './tokens'

export class DragFeature {
	readonly action = event<DragAction>()

	#unsub?: () => void

	constructor(
		private readonly props: PropsFeature,
		private readonly value: ValueFeature,
		private readonly parsing: ParsingFeature
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
			this.value.replaceAll(newValue, {
				recover: this.#recoverAfterDrag(action, rows, newValue),
			})
		}
	}

	#add(action: Extract<DragAction, {type: 'add'}>) {
		const value = this.value.current()
		const rawRows = this.parsing.tokens()
		const rows = rawRows.length > 0 ? rawRows : [EMPTY_TEXT_TOKEN]
		const newRowContent = createRowContent(this.props.options())
		const newValue = addDragRow(value, rows, action.afterIndex, newRowContent)
		this.value.replaceAll(newValue, {
			recover: this.#recoverAfterDrag(action, rows, newValue),
		})
	}

	#delete(action: Extract<DragAction, {type: 'delete'}>) {
		const value = this.value.current()
		const rows = this.parsing.tokens()
		const newValue = deleteDragRow(value, rows, action.index)
		this.value.replaceAll(newValue, {
			recover: this.#recoverAfterDrag(action, rows, newValue),
		})
	}

	#duplicate(action: Extract<DragAction, {type: 'duplicate'}>) {
		const value = this.value.current()
		const rows = this.parsing.tokens()
		const newValue = duplicateDragRow(value, rows, action.index)
		this.value.replaceAll(newValue, {
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