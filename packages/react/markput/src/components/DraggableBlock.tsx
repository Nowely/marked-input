import type {ReactNode, DragEvent, CSSProperties, MouseEvent} from 'react'
import {Children, memo, useCallback, useRef, useState, useEffect} from 'react'

interface DraggableBlockProps {
	blockIndex: number
	children: ReactNode
	readOnly: boolean
	onReorder: (sourceIndex: number, targetIndex: number) => void
	onAdd?: (afterIndex: number) => void
	onDelete?: (index: number) => void
	onDuplicate?: (index: number) => void
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

interface MenuPosition {
	top: number
	left: number
}

interface BlockMenuProps {
	position: MenuPosition
	onDelete: () => void
	onDuplicate: () => void
	onClose: () => void
}

const BlockMenu = memo(({position, onDelete, onDuplicate, onClose}: BlockMenuProps) => {
	const menuRef = useRef<HTMLDivElement>(null)
	const [hoveredItem, setHoveredItem] = useState<string | null>(null)

	useEffect(() => {
		const handleMouseDown = (e: globalThis.MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose()
			}
		}
		const handleKeyDown = (e: globalThis.KeyboardEvent) => {
			if (e.key === 'Escape') onClose()
		}
		document.addEventListener('mousedown', handleMouseDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('mousedown', handleMouseDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [onClose])

	const menuStyle: CSSProperties = {
		position: 'fixed',
		top: position.top,
		left: position.left,
		background: 'white',
		border: '1px solid rgba(55, 53, 47, 0.16)',
		borderRadius: 6,
		boxShadow: '0 4px 16px rgba(15, 15, 15, 0.12)',
		padding: 4,
		zIndex: 9999,
		minWidth: 160,
		fontSize: 14,
	}

	const itemStyle = (key: string): CSSProperties => ({
		display: 'flex',
		alignItems: 'center',
		gap: 8,
		padding: '6px 10px',
		borderRadius: 4,
		cursor: 'pointer',
		color: key === 'delete' ? '#eb5757' : 'inherit',
		background:
			hoveredItem === key
				? key === 'delete'
					? 'rgba(235, 87, 87, 0.06)'
					: 'rgba(55, 53, 47, 0.06)'
				: 'transparent',
		userSelect: 'none',
	})

	return (
		<div ref={menuRef} style={menuStyle}>
			<div
				style={itemStyle('duplicate')}
				onMouseEnter={() => setHoveredItem('duplicate')}
				onMouseLeave={() => setHoveredItem(null)}
				onMouseDown={e => {
					e.preventDefault()
					onDuplicate()
					onClose()
				}}
			>
				<span>⧉</span>
				<span>Duplicate</span>
			</div>
			<div
				style={itemStyle('delete')}
				onMouseEnter={() => setHoveredItem('delete')}
				onMouseLeave={() => setHoveredItem(null)}
				onMouseDown={e => {
					e.preventDefault()
					onDelete()
					onClose()
				}}
			>
				<span>🗑</span>
				<span>Delete</span>
			</div>
		</div>
	)
})

BlockMenu.displayName = 'BlockMenu'

export const DraggableBlock = memo(
	({blockIndex, children, readOnly, onReorder, onAdd, onDelete, onDuplicate}: DraggableBlockProps) => {
		const [isHovered, setIsHovered] = useState(false)
		const [isDragging, setIsDragging] = useState(false)
		const [dropPosition, setDropPosition] = useState<DropPosition>(null)
		const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null)
		const blockRef = useRef<HTMLDivElement>(null)
		const gripRef = useRef<HTMLButtonElement>(null)

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

		const handleGripClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
			e.preventDefault()
			if (!gripRef.current) return
			const rect = gripRef.current.getBoundingClientRect()
			setMenuPosition({top: rect.bottom + 4, left: rect.left})
		}, [])

		const handleAddClick = useCallback(
			(e: MouseEvent<HTMLButtonElement>) => {
				e.preventDefault()
				onAdd?.(blockIndex)
			},
			[blockIndex, onAdd]
		)

		const blockStyle: CSSProperties = {
			position: 'relative',
			// Extend hover zone to the left (into gutter) without indenting text
			marginLeft: readOnly ? 0 : -48,
			paddingLeft: readOnly ? 0 : 48,
			transition: 'opacity 0.2s ease',
			opacity: isDragging ? 0.4 : 1,
			background: isHovered && !readOnly ? 'rgba(55, 53, 47, 0.03)' : 'transparent',
			borderRadius: 3,
			minHeight: '1.2em',
		}

		const sidePanelStyle: CSSProperties = {
			position: 'absolute',
			left: 4,
			top: 0,
			bottom: 0,
			width: 44,
			display: 'flex',
			alignItems: 'center',
			opacity: isHovered && !isDragging ? 1 : 0,
			transition: 'opacity 0.15s ease',
			pointerEvents: isHovered ? 'auto' : 'none',
		}

		const sideButtonStyle: CSSProperties = {
			width: 24,
			height: 24,
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			cursor: 'pointer',
			borderRadius: 4,
			color: '#9ca3af',
			background: 'none',
			border: 'none',
			padding: 0,
			margin: 0,
			font: 'inherit',
			lineHeight: 1,
			flexShrink: 0,
			userSelect: 'none',
		}

		const dropIndicatorStyle: CSSProperties = {
			position: 'absolute',
			left: 48,
			right: 0,
			height: 2,
			backgroundColor: '#3b82f6',
			borderRadius: 1,
			pointerEvents: 'none',
			zIndex: 10,
		}

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
				{dropPosition === 'before' && <div style={{...dropIndicatorStyle, top: -1}} />}

				{!readOnly && (
					<div style={sidePanelStyle}>
						<button
							type="button"
							style={sideButtonStyle}
							aria-label="Add block below"
							onClick={handleAddClick}
						>
							<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
								<path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
							</svg>
						</button>
						<button
							ref={gripRef}
							type="button"
							draggable
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onClick={handleGripClick}
							style={{...sideButtonStyle, cursor: isDragging ? 'grabbing' : 'grab'}}
							aria-label="Drag to reorder or click for options"
						>
							<GripIcon />
						</button>
					</div>
				)}

				{Children.count(children) === 0 ? <br /> : children}

				{dropPosition === 'after' && <div style={{...dropIndicatorStyle, bottom: -1}} />}

				{menuPosition && onDelete && onDuplicate && (
					<BlockMenu
						position={menuPosition}
						onDelete={() => onDelete(blockIndex)}
						onDuplicate={() => onDuplicate(blockIndex)}
						onClose={() => setMenuPosition(null)}
					/>
				)}
			</div>
		)
	}
)

DraggableBlock.displayName = 'DraggableBlock'