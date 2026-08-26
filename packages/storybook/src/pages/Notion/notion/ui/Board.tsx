import {useState} from 'react'

import {BoardCard} from './BoardCard'
import {BoardColumn} from './BoardColumn'
import type {ChipTone} from './Chip'

import styles from '../theme/notion.module.css'

export interface BoardCardData {
	id: string
	title: string
	tag?: {label: string; tone: ChipTone}
}

export interface BoardColumnData {
	id: string
	title: string
	cards: readonly BoardCardData[]
}

export interface BoardProps {
	columns: readonly BoardColumnData[]
	/** A card moved between columns. The whole new arrangement, for the owner to store. */
	onMove: (columns: readonly BoardColumnData[]) => void
}

/**
 * The board widget, and it owns NOTHING. The arrangement is the prop; a drop announces the next
 * arrangement and re-renders when the owner writes it back.
 *
 * IT USED TO OWN IT, seeded from the prop and diverging from then on, on the theory that a board
 * is not editor content. It IS editor content here — the row's raw body describes these columns —
 * so the divergence was a defect with three faces: the value the editor emitted never changed,
 * undo had nothing to undo, and every count outside the board went stale against what was on
 * screen. The only state left is `dragged`, which is one gesture in flight and belongs to nobody
 * else.
 *
 * Drag lives entirely in `BoardCard` (source) and `BoardColumn` (target); the board only holds
 * the two ends together.
 */
export const Board = ({columns, onMove}: BoardProps) => {
	const [dragged, setDragged] = useState<{columnId: string; cardId: string} | undefined>(undefined)

	const dropInto = (targetColumnId: string) => {
		if (!dragged || dragged.columnId === targetColumnId) return
		const source = columns.find(column => column.id === dragged.columnId)
		const card = source?.cards.find(candidate => candidate.id === dragged.cardId)
		if (!card) return

		setDragged(undefined)
		onMove(
			columns.map(column => {
				if (column.id === dragged.columnId) {
					return {...column, cards: column.cards.filter(candidate => candidate.id !== card.id)}
				}
				if (column.id === targetColumnId) return {...column, cards: [...column.cards, card]}
				return column
			})
		)
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