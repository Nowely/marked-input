import type {DragEvent} from 'react'
import {useState} from 'react'

import type {ChipTone} from './Chip'
import {Chip} from './Chip'

import styles from '../theme/notion.module.css'

export interface BoardCardProps {
	title: string
	tag?: {label: string; tone: ChipTone}
	/** Announces the drag. The board that rendered the card is the one that knows WHICH card it is. */
	onDragStart?: () => void
	onDragEnd?: () => void
}

/**
 * A draggable board card. It owns the HTML5 drag source and nothing else: no document listener,
 * no focus call, and `preventDefault` only where the drop protocol demands it (in `BoardColumn`,
 * on `dragover`).
 */
export const BoardCard = ({title, tag, onDragStart, onDragEnd}: BoardCardProps) => {
	const [dragging, setDragging] = useState(false)

	const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
		// Firefox starts no drag at all unless the transfer carries a payload.
		event.dataTransfer.setData('text/plain', title)
		event.dataTransfer.effectAllowed = 'move'
		setDragging(true)
		onDragStart?.()
	}

	const handleDragEnd = () => {
		setDragging(false)
		onDragEnd?.()
	}

	return (
		<div
			className={dragging ? styles.boardCardDragging : styles.boardCardDraggable}
			draggable
			onDragEnd={handleDragEnd}
			onDragStart={handleDragStart}
		>
			<span className={styles.boardCardTitle}>{title}</span>
			{tag !== undefined && <Chip tone={tag.tone}>{tag.label}</Chip>}
		</div>
	)
}