export function getDragDropPosition(clientY: number, rect: DOMRect): 'before' | 'after' {
	return clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

export function parseDragSourceIndex(dataTransfer: DataTransfer): number | null {
	const index = parseInt(dataTransfer.getData('text/plain'), 10)
	return isNaN(index) ? null : index
}

export function getDragTargetIndex(blockIndex: number, position: 'before' | 'after'): number {
	return position === 'before' ? blockIndex : blockIndex + 1
}