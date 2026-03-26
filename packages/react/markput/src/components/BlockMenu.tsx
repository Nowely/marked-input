import {cx, isClickOutside, isEscapeKey} from '@markput/core'
import type {Token} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useEffect, useRef, useState} from 'react'

import {useStore} from '../lib/providers/StoreContext'

import styles from '@markput/core/styles.module.css'

export const BlockMenu = memo(({token}: {token: Token}) => {
	const store = useStore()
	const blockStore = store.blocks.get(token)
	const menuOpen = blockStore.state.menuOpen.use()
	const menuPosition = blockStore.state.menuPosition.use()

	const menuRef = useRef<HTMLDivElement>(null)
	const [hoveredItem, setHoveredItem] = useState<string | null>(null)

	const closeMenuRef = useRef(blockStore.closeMenu)
	closeMenuRef.current = blockStore.closeMenu

	useEffect(() => {
		if (!menuOpen) return
		const handleMouseDown = (e: globalThis.MouseEvent) => {
			if (isClickOutside(e.target, menuRef.current)) closeMenuRef.current()
		}
		const handleKeyDown = (e: globalThis.KeyboardEvent) => {
			if (isEscapeKey(e)) closeMenuRef.current()
		}
		document.addEventListener('mousedown', handleMouseDown)
		document.addEventListener('keydown', handleKeyDown)
		return () => {
			document.removeEventListener('mousedown', handleMouseDown)
			document.removeEventListener('keydown', handleKeyDown)
		}
	}, [menuOpen])

	if (!menuOpen) return null

	const menuStyle: CSSProperties = {
		position: 'fixed',
		top: menuPosition.top,
		left: menuPosition.left,
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

	const separatorStyle: CSSProperties = {
		height: 1,
		background: 'rgba(55, 53, 47, 0.09)',
		margin: '4px 0',
	}

	return (
		<div ref={menuRef} style={menuStyle}>
			<div
				style={itemStyle('add')}
				onMouseEnter={() => setHoveredItem('add')}
				onMouseLeave={() => setHoveredItem(null)}
				onMouseDown={e => {
					e.preventDefault()
					blockStore.addBlock()
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
					blockStore.duplicateBlock()
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
					blockStore.deleteBlock()
				}}
			>
				<span className={cx(styles.Icon, styles.IconTrash)} />
				<span>Delete</span>
			</div>
		</div>
	)
})

BlockMenu.displayName = 'BlockMenu'