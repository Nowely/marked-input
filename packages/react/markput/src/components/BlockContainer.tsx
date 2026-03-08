import {
	resolveSlot,
	resolveSlotProps,
	splitTokensIntoBlocks,
	reorderBlocks,
	addBlock,
	deleteBlock,
	duplicateBlock,
	parseWithParser,
	type Block,
} from '@markput/core'
import type {CSSProperties, ElementType} from 'react'
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {DraggableBlock, type MenuPosition} from './DraggableBlock'
import {Token} from './Token'

interface BlockMenuProps {
	position: MenuPosition
	onAdd: () => void
	onDelete: () => void
	onDuplicate: () => void
	onClose: () => void
}

const BlockMenu = memo(({position, onAdd, onDelete, onDuplicate, onClose}: BlockMenuProps) => {
	const menuRef = useRef<HTMLDivElement>(null)
	const [hoveredItem, setHoveredItem] = useState<string | null>(null)

	// Keep a ref so the effect stays stable (empty deps) while always calling
	// the latest onClose without re-registering listeners on every render.
	const onCloseRef = useRef(onClose)
	onCloseRef.current = onClose

	useEffect(() => {
		const handleMouseDown = (e: globalThis.MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onCloseRef.current()
			}
		}
		const handleKeyDown = (e: globalThis.KeyboardEvent) => {
			if (e.key === 'Escape') onCloseRef.current()
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
				style={itemStyle('add')}
				onMouseEnter={() => setHoveredItem('add')}
				onMouseLeave={() => setHoveredItem(null)}
				onMouseDown={e => {
					e.preventDefault()
					onAdd()
					onClose()
				}}
			>
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
				</svg>
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

interface MenuState {
	index: number
	position: MenuPosition
}

export const BlockContainer = memo(() => {
	const store = useStore()
	const tokens = store.state.tokens.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const className = store.state.className.use()
	const style = store.state.style.use()
	const readOnly = store.state.readOnly.use()
	const value = store.state.value.use()
	const onChange = store.state.onChange.use()
	const key = store.key
	const refs = store.refs

	const [menuState, setMenuState] = useState<MenuState | null>(null)

	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	const blocks = useMemo(() => splitTokensIntoBlocks(tokens), [tokens])
	const blocksRef = useRef<Block[]>(blocks)
	blocksRef.current = blocks

	const applyNewValue = useCallback(
		(newValue: string) => {
			if (!onChange) return
			const newTokens = parseWithParser(store, newValue)
			store.state.tokens.set(newTokens)
			store.state.previousValue.set(newValue)
			onChange(newValue)
		},
		[store, onChange]
	)

	const handleReorder = useCallback(
		(sourceIndex: number, targetIndex: number) => {
			if (!value || !onChange) return
			const newValue = reorderBlocks(value, blocksRef.current, sourceIndex, targetIndex)
			if (newValue !== value) applyNewValue(newValue)
		},
		[value, onChange, applyNewValue]
	)

	const handleAdd = useCallback(
		(afterIndex: number) => {
			if (!value || !onChange) return
			applyNewValue(addBlock(value, blocksRef.current, afterIndex))
		},
		[value, onChange, applyNewValue]
	)

	const handleDelete = useCallback(
		(index: number) => {
			if (!value || !onChange) return
			applyNewValue(deleteBlock(value, blocksRef.current, index))
		},
		[value, onChange, applyNewValue]
	)

	const handleDuplicate = useCallback(
		(index: number) => {
			if (!value || !onChange) return
			applyNewValue(duplicateBlock(value, blocksRef.current, index))
		},
		[value, onChange, applyNewValue]
	)

	const handleRequestMenu = useCallback((index: number, rect: DOMRect) => {
		setMenuState({index, position: {top: rect.bottom + 4, left: rect.left}})
	}, [])

	const closeMenu = useCallback(() => setMenuState(null), [])

	return (
		<>
			<ContainerComponent
				ref={(el: HTMLDivElement | null) => (refs.container = el)}
				{...containerProps}
				className={className}
				style={style}
			>
				{blocks.map((block, index) => (
					<DraggableBlock
						key={block.id}
						blockIndex={index}
						readOnly={readOnly}
						onReorder={handleReorder}
						onRequestMenu={handleRequestMenu}
					>
						{block.tokens.map(token => (
							<Token key={key.get(token)} mark={token} />
						))}
					</DraggableBlock>
				))}
			</ContainerComponent>
			{menuState && (
				<BlockMenu
					position={menuState.position}
					onAdd={() => {
						handleAdd(menuState.index)
						closeMenu()
					}}
					onDelete={() => {
						handleDelete(menuState.index)
						closeMenu()
					}}
					onDuplicate={() => {
						handleDuplicate(menuState.index)
						closeMenu()
					}}
					onClose={closeMenu}
				/>
			)}
		</>
	)
})

BlockContainer.displayName = 'BlockContainer'