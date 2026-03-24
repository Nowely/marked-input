import type {ReactNode, DragEvent, CSSProperties, MouseEvent} from 'react'
import {Children, memo, useCallback, useRef, useState} from 'react'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export interface MenuPosition {
	top: number
	left: number
}

interface DragMarkProps {
	blockIndex: number
	children: ReactNode
	readOnly: boolean
	alwaysShowHandle?: boolean
	onReorder: (sourceIndex: number, targetIndex: number) => void
	onRequestMenu?: (index: number, rect: DOMRect) => void
}

type DropPosition = 'before' | 'after' | null

export const DragMark = memo(
	({blockIndex, children, readOnly, alwaysShowHandle, onReorder, onRequestMenu}: DragMarkProps) => {
		const [isHovered, setIsHovered] = useState(false)
		const [isDragging, setIsDragging] = useState(false)
		const [dropPosition, setDropPosition] = useState<DropPosition>(null)
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

		const handleGripClick = useCallback(
			(e: MouseEvent<HTMLButtonElement>) => {
				e.preventDefault()
				if (!gripRef.current) return
				onRequestMenu?.(blockIndex, gripRef.current.getBoundingClientRect())
			},
			[blockIndex, onRequestMenu]
		)

		const blockStyle: CSSProperties = {
			position: 'relative',
			marginLeft: 0,
			transition: 'opacity 0.2s ease',
			opacity: isDragging ? 0.4 : 1,
			background: 'transparent',
			borderRadius: 3,
			minHeight: '1.2em',
			outline: 'none',
		}

		const sidePanelStyle: CSSProperties = {
			position: 'absolute',
			left: readOnly ? 0 : -24,
			top: 0,
			bottom: 0,
			width: 24,
			display: 'flex',
			alignItems: 'center',
			opacity: alwaysShowHandle || (isHovered && !isDragging) ? 1 : 0,
			transition: alwaysShowHandle ? undefined : 'opacity 0.15s ease',
			pointerEvents: alwaysShowHandle || isHovered ? 'auto' : 'none',
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
			left: 0,
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
				data-testid="block"
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
							ref={gripRef}
							type="button"
							draggable
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onClick={handleGripClick}
							style={{...sideButtonStyle, cursor: isDragging ? 'grabbing' : 'grab'}}
							aria-label="Drag to reorder or click for options"
						>
							<span className={iconGrip} />
						</button>
					</div>
				)}

				{Children.count(children) === 0 ? <br /> : children}

				{dropPosition === 'after' && <div style={{...dropIndicatorStyle, bottom: -1}} />}
			</div>
		)
	}
)

DragMark.displayName = 'DragMark'