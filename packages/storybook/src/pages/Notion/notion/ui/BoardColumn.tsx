import type {DragEvent, ReactNode} from 'react'
import {useState} from 'react'

import styles from '../theme/notion.module.css'

export interface BoardColumnProps {
	title: string
	/** Rendered as given. The board that owns the cards decides whether that is `cards.length`. */
	count: number
	/** A card was dropped here. Absent means the column takes no drops. */
	onCardDrop?: () => void
	children?: ReactNode
}

/** A titled drop target. The highlight is its own state — nobody outside needs to know about it. */
export const BoardColumn = ({title, count, onCardDrop, children}: BoardColumnProps) => {
	const [isOver, setIsOver] = useState(false)

	const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (!onCardDrop) return
		// The only way to say "a drop is allowed here"; without it `drop` never fires.
		event.preventDefault()
		event.dataTransfer.dropEffect = 'move'
		setIsOver(true)
	}

	// `dragleave` also fires when the pointer crosses INTO a child, which would flicker the
	// highlight off on every card it passes over.
	const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
		const {relatedTarget} = event
		if (relatedTarget instanceof Node && event.currentTarget.contains(relatedTarget)) return
		setIsOver(false)
	}

	const handleDrop = (event: DragEvent<HTMLDivElement>) => {
		if (!onCardDrop) return
		event.preventDefault()
		setIsOver(false)
		onCardDrop()
	}

	return (
		<div
			className={isOver ? styles.boardColumnDropTarget : styles.boardColumn}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<div className={styles.boardColumnHeader}>
				<span>{title}</span>
				<span className={styles.boardColumnCount}>{count}</span>
			</div>
			{children}
		</div>
	)
}