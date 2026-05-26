import {event, watch} from '../../shared/signals'
import type {DragAction} from '../../shared/types'
import type {EditController} from '../edit'
import type {TokenModel} from '../parsing/TokenModel'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {applyDragAction} from './operations'

export class BlockController {
	readonly action = event<DragAction>()

	constructor(
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly tokens: TokenModel,
		private readonly edit: EditController
	) {
		watch(this.action, action => {
			if (!this.props.layout.isBlock() || !this.props.draggable()) return
			const value = this.value.current()
			const result = applyDragAction(value, this.tokens.current(), action, this.props.options())
			if (result.value === value) return
			this.edit.replace({start: 0, end: -1}, result.value, result.caret)
		})
	}
}