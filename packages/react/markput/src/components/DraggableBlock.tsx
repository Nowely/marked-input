import type {ReactNode, DragEvent, CSSProperties} from 'react'
import {memo, useCallback, useRef, useState} from 'react'

interface DraggableBlockProps {
	blockIndex: number
	children: ReactNode
	readOnly: boolean
	onReorder: (sourceIndex: number, targetIndex: number) => void
}

const HANDLE_STYLES: CSSProperties = {
	position: 'absolute',
	left: -28,
	top: 2,
	width: 20,
	height: 20,
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	cursor: 'grab',
	borderRadius: 4,
	opacity: 0,
	transition: 'opacity 0.15s ease',
	userSelect: 'none',
	color: '#9ca3af',
	flexShrink: 0,
	background: 'none',
	border: 'none',
	padding: 0,
	margin: 0,
	font: 'inherit',
	lineHeight: 1,
}

const HANDLE_VISIBLE_STYLES: CSSProperties = {
	...HANDLE_STYLES,
	opacity: 1,
}

const HANDLE_DRAGGING_STYLES: CSSProperties = {
	...HANDLE_VISIBLE_STYLES,
	cursor: 'grabbing',
}

const BLOCK_STYLES: CSSProperties = {
	position: 'relative',
	paddingLeft: 4,
	transition: 'opacity 0.2s ease',
}

const DROP_INDICATOR_STYLES: CSSProperties = {
	position: 'absolute',
	left: 0,
	right: 0,
	height: 2,
	backgroundColor: '#3b82f6',
	borderRadius: 1,
	pointerEvents: 'none',
	zIndex: 10,
}

const GripIcon = memo(() => (
	<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
		<circle cx="5" cy="3" r="1.5" />
		<circle cx="11" cy="3" r="1.5" />
		<circle cx="5" cy="8" r="1.5" />
		<circle cx="11" cy="8" r="1.5" />
		<circle cx="5" cy="13" r="1.5" />
		<circle cx="11" cy="13" r="1.5" />
	</svg>
))

GripIcon.displayName = 'GripIcon'

type DropPosition = 'before' | 'after' | null

export const DraggableBlock = memo(({blockIndex, children, readOnly, onReorder}: DraggableBlockProps) => {
	const [isHovered, setIsHovered] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [dropPosition, setDropPosition] = useState<DropPosition>(null)
	const blockRef = useRef<HTMLDivElement>(null)

	const handleMouseEnter = useCallback(() => setIsHovered(true), [])
	const handleMouseLeave = useCallback(() => setIsHovered(false), [])

	const handleDragStart = useCallback(
		(e: DragEvent<HTMLButtonElement>) => {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', String(blockIndex))
			setIsDragging(true)

			if (blockRef.current) {
				e.dataTransfer.setDragImage(blockRef.current, 0, 0)
			}
		},
		[blockIndex]
	)

	const handleDragEnd = useCallback(() => {
		setIsDragging(false)
		setDropPosition(null)
	}, [])

	const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'

		if (!blockRef.current) return

		const rect = blockRef.current.getBoundingClientRect()
		const midY = rect.top + rect.height / 2
		setDropPosition(e.clientY < midY ? 'before' : 'after')
	}, [])

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		if (e.currentTarget.contains(e.relatedTarget as Node)) return
		setDropPosition(null)
	}, [])

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
			if (isNaN(sourceIndex)) return

			const targetIndex = dropPosition === 'before' ? blockIndex : blockIndex + 1
			setDropPosition(null)
			onReorder(sourceIndex, targetIndex)
		},
		[blockIndex, dropPosition, onReorder]
	)

	const blockStyle: CSSProperties = {
		...BLOCK_STYLES,
		opacity: isDragging ? 0.4 : 1,
	}

	const handleStyle = readOnly
		? {...HANDLE_STYLES, display: 'none'}
		: isDragging
			? HANDLE_DRAGGING_STYLES
			: isHovered
				? HANDLE_VISIBLE_STYLES
				: HANDLE_STYLES

	return (
		<div
			ref={blockRef}
			style={blockStyle}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{dropPosition === 'before' && <div style={{...DROP_INDICATOR_STYLES, top: -1}} />}

			<button
				type="button"
				draggable={!readOnly}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				style={handleStyle}
				aria-label="Drag to reorder"
			>
				<GripIcon />
			</button>

			{children}

			{dropPosition === 'after' && <div style={{...DROP_INDICATOR_STYLES, bottom: -1}} />}
		</div>
	)
})

DraggableBlock.displayName = 'DraggableBlock'
