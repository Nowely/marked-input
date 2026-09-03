import {defineComponent, ref} from 'vue'

import type {BoardCardData, BoardColumnData} from '../vocabulary'
import {BoardCard} from './BoardCard'
import {BoardColumn} from './BoardColumn'

import styles from '../theme/notion.module.css'

export type {BoardCardData, BoardColumnData}

export interface BoardProps {
	columns: readonly BoardColumnData[]
}

/**
 * The board, and it owns NOTHING. The arrangement is the prop; a drop announces the next
 * arrangement and re-renders when the owner writes it back — the columns ARE the row's raw body,
 * so a copy kept here would go stale against the value the editor emits.
 *
 * The only state left is `dragged`, which is one gesture in flight and belongs to nobody else.
 */
export const Board = defineComponent({
	name: 'Board',
	components: {BoardCard, BoardColumn},
	props: {columns: {type: Array as () => readonly BoardColumnData[], required: true}},
	emits: ['move'],
	setup(props, {emit}) {
		const dragged = ref<{columnId: string; cardId: string} | undefined>(undefined)

		const dropInto = (targetColumnId: string) => {
			const inFlight = dragged.value
			if (!inFlight || inFlight.columnId === targetColumnId) return
			const source = props.columns.find(column => column.id === inFlight.columnId)
			const card = source?.cards.find((candidate: BoardCardData) => candidate.id === inFlight.cardId)
			if (!card) return

			dragged.value = undefined
			emit(
				'move',
				props.columns.map(column => {
					if (column.id === inFlight.columnId) {
						return {...column, cards: column.cards.filter(candidate => candidate.id !== card.id)}
					}
					if (column.id === targetColumnId) return {...column, cards: [...column.cards, card]}
					return column
				})
			)
		}

		return {
			styles,
			dropInto,
			pickUp: (columnId: string, cardId: string) => {
				dragged.value = {columnId, cardId}
			},
			drop: () => {
				dragged.value = undefined
			},
		}
	},
	template: `
		<div :class="styles.board">
			<BoardColumn
				v-for="column in columns"
				:key="column.id"
				:count="column.cards.length"
				:title="column.title"
				@card-drop="dropInto(column.id)"
			>
				<BoardCard
					v-for="card in column.cards"
					:key="card.id"
					:tag="card.tag"
					:title="card.title"
					@drag-end="drop()"
					@drag-start="pickUp(column.id, card.id)"
				/>
			</BoardColumn>
		</div>
	`,
})