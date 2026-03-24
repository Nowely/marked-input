/**
 * Returns whether a drag event should drop 'before' or 'after' the target block,
 * based on the vertical midpoint of the block's bounding rect.
 */
export function getDragDropPosition(clientY: number, rect: DOMRect): 'before' | 'after' {
	return clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

/**
 * Parses the drag source block index from the event's data transfer.
 * Returns `null` if the data is absent or not a valid integer.
 */
export function parseDragSourceIndex(dataTransfer: DataTransfer): number | null {
	const index = parseInt(dataTransfer.getData('text/plain'), 10)
	return isNaN(index) ? null : index
}

/**
 * Returns the target insertion index for a drop operation.
 * 'before' → insert at blockIndex; 'after' → insert at blockIndex + 1.
 */
export function getDragTargetIndex(blockIndex: number, position: 'before' | 'after'): number {
	return position === 'before' ? blockIndex : blockIndex + 1
}