import {
	cx,
	resolveSlot,
	resolveSlotProps,
	splitTokensIntoBlocks,
	reorderBlocks,
	addBlock,
	deleteBlock,
	duplicateBlock,
	getAlwaysShowHandle,
	type Block,
} from '@markput/core'
import type {CSSProperties, ElementType} from 'react'
import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {DraggableBlock, type MenuPosition} from './DraggableBlock'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

const EMPTY_BLOCK: Block = {id: 'block-empty', tokens: [], startPos: 0, endPos: 0}

interface BlockMenuProps {
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
	const block = store.state.block.use()
	const alwaysShowHandle = getAlwaysShowHandle(block)
	const value = store.state.value.use()
	const onChange = store.state.onChange.use()
	const key = store.key
	const refs = store.refs

	const [menuState, setMenuState] = useState<MenuState | null>(null)

	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	const blocks = useMemo(() => {
		const result = splitTokensIntoBlocks(tokens)
		return result.length > 0 ? result : [EMPTY_BLOCK]
	}, [tokens])
	const blocksRef = useRef<Block[]>(blocks)
	blocksRef.current = blocks

	const handleReorder = useCallback(
		(sourceIndex: number, targetIndex: number) => {
			if (value == null || !onChange) return
			const newValue = reorderBlocks(value, blocksRef.current, sourceIndex, targetIndex)
			if (newValue !== value) store.applyValue(newValue)
		},
		[store, value, onChange]
	)

	const handleAdd = useCallback(
		(afterIndex: number) => {
			if (value == null || !onChange) return
			store.applyValue(addBlock(value, blocksRef.current, afterIndex))
			queueMicrotask(() => {
				const container = store.refs.container
				if (!container) return
				const newBlockIndex = afterIndex + 1
				const target = container.children[newBlockIndex] as HTMLElement | undefined
				target?.focus()
			})
		},
		[store, value, onChange]
	)

	const handleDelete = useCallback(
		(index: number) => {
			if (value == null || !onChange) return
			store.applyValue(deleteBlock(value, blocksRef.current, index))
		},
		[store, value, onChange]
	)

	const handleDuplicate = useCallback(
		(index: number) => {
			if (value == null || !onChange) return
			store.applyValue(duplicateBlock(value, blocksRef.current, index))
		},
		[store, value, onChange]
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
						alwaysShowHandle={alwaysShowHandle}
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