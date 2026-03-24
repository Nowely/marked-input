import {cx, isClickOutside, isEscapeKey} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useEffect, useRef, useState} from 'react'

import type {MenuPosition} from './DragMark'

import styles from '@markput/core/styles.module.css'

export interface BlockMenuProps {
	position: MenuPosition
	onAdd: () => void
	onDelete: () => void
	onDuplicate: () => void
	onClose: () => void
}

const separatorStyle: CSSProperties = {
	height: 1,
	background: 'rgba(55, 53, 47, 0.09)',
	margin: '4px 0',
}

export const BlockMenu = memo(({position, onAdd, onDelete, onDuplicate, onClose}: BlockMenuProps) => {
	const menuRef = useRef<HTMLDivElement>(null)
	const [hoveredItem, setHoveredItem] = useState<string | null>(null)

	const onCloseRef = useRef(onClose)
	onCloseRef.current = onClose

	useEffect(() => {
		const handleMouseDown = (e: globalThis.MouseEvent) => {
			if (isClickOutside(e.target, menuRef.current)) onCloseRef.current()
		}
		const handleKeyDown = (e: globalThis.KeyboardEvent) => {
			if (isEscapeKey(e)) onCloseRef.current()
		}
		document.addEventListener('mousedown', handleMouseDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('mousedown', handleMouseDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [])

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
		color: key === 'delete' ? '#eb5757' : 'rgba(55, 53, 47, 0.85)',
		background:
			hoveredItem === key
				? key === 'delete'
					? 'rgba(235, 87, 87, 0.06)'
					: 'rgba(55, 53, 47, 0.06)'
				: 'transparent',
		transition: 'background 0.1s ease',
		userSelect: 'none',
		lineHeight: 1,
	})

	return (
		<div ref={menuRef} style={menuStyle}>
			<div
				style={itemStyle('add')}
				onMouseEnter={() => setHoveredItem('add')}
				onMouseLeave={() => setHoveredItem(null)}
				onMouseDown={e => {
					e.preventDefault()
					onAdd()
					onClose()
				}}
			>
				<span className={cx(styles.Icon, styles.IconAdd)} />
				<span>Add below</span>
			</div>
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
				<span className={cx(styles.Icon, styles.IconDuplicate)} />
				<span>Duplicate</span>
			</div>
			<div style={separatorStyle} />
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
				<span className={cx(styles.Icon, styles.IconTrash)} />
				<span>Delete</span>
			</div>
		</div>
	)
})

BlockMenu.displayName = 'BlockMenu'