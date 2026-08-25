import {useState} from 'react'

import {BoardCard} from './BoardCard'
import {BoardColumn} from './BoardColumn'
import type {ChipTone} from './Chip'

import styles from '../theme/notion.module.css'

export interface BoardProps {
	columns: readonly {
		id: string
		title: string
		cards: readonly {id: string; title: string; tag?: {label: string; tone: ChipTone}}[]
	}[]
}

/**
 * The board widget. It owns its arrangement once mounted — the prop seeds it and the drags own it
 * from then on — because this board is not editor content: nothing outside it has to agree about
 * where a card sits. Drag lives entirely in `BoardCard` (source) and `BoardColumn` (target); the
 * board only holds the two ends together.
 */
export const Board = ({columns: initialColumns}: BoardProps) => {
	const [columns, setColumns] = useState(initialColumns)
	const [dragged, setDragged] = useState<{columnId: string; cardId: string} | undefined>(undefined)

	const dropInto = (targetColumnId: string) => {
		if (!dragged || dragged.columnId === targetColumnId) return
		const source = columns.find(column => column.id === dragged.columnId)
		const card = source?.cards.find(candidate => candidate.id === dragged.cardId)
		if (!card) return

		setColumns(current =>
			current.map(column => {
				if (column.id === dragged.columnId) {
					return {...column, cards: column.cards.filter(candidate => candidate.id !== card.id)}
				}
				if (column.id === targetColumnId) return {...column, cards: [...column.cards, card]}
				return column
			})
		)
		setDragged(undefined)
	}

	return (
		<div className={styles.board}>
			{columns.map(column => (
				<BoardColumn
					count={column.cards.length}
					key={column.id}
					onCardDrop={() => dropInto(column.id)}
					title={column.title}
				>
					{column.cards.map(card => (
						<BoardCard
							key={card.id}
							onDragEnd={() => setDragged(undefined)}
							onDragStart={() => setDragged({cardId: card.id, columnId: column.id})}
							tag={card.tag}
							title={card.title}
						/>
					))}
				</BoardColumn>
			))}
		</div>
	)
}