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

const svgProps = {
	width: 14,
	height: 14,
	fill: 'currentColor',
	style: {display: 'block', flexShrink: 0, opacity: 0.75} as CSSProperties,
}

const AddIcon = () => (
	<svg {...svgProps} viewBox="0 0 16 16">
		<path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
	</svg>
)

const DuplicateIcon = () => (
	<svg {...svgProps} viewBox="0 0 24 24">
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M10 9C9.44772 9 9 9.44772 9 10V20C9 20.5523 9.44772 21 10 21H20C20.5523 21 21 20.5523 21 20V10C21 9.44772 20.5523 9 20 9H10ZM7 10C7 8.34315 8.34315 7 10 7H20C21.6569 7 23 8.34315 23 10V20C23 21.6569 21.6569 23 20 23H10C8.34315 23 7 21.6569 7 20V10Z"
		/>
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M4 3C3.45228 3 3 3.45228 3 4V14C3 14.5477 3.45228 15 4 15C4.55228 15 5 15.4477 5 16C5 16.5523 4.55228 17 4 17C2.34772 17 1 15.6523 1 14V4C1 2.34772 2.34772 1 4 1H14C15.6523 1 17 2.34772 17 4C17 4.55228 16.5523 5 16 5C15.4477 5 15 4.55228 15 4C15 3.45228 14.5477 3 14 3H4Z"
		/>
	</svg>
)

const TrashIcon = () => (
	<svg {...svgProps} viewBox="0 0 24 24">
		<path
			fillRule="evenodd"
			clipRule="evenodd"
			d="M7 5V4C7 3.17477 7.40255 2.43324 7.91789 1.91789C8.43324 1.40255 9.17477 1 10 1H14C14.8252 1 15.5668 1.40255 16.0821 1.91789C16.5975 2.43324 17 3.17477 17 4V5H21C21.5523 5 22 5.44772 22 6C22 6.55228 21.5523 7 21 7H20V20C20 20.8252 19.5975 21.5668 19.0821 22.0821C18.5668 22.5975 17.8252 23 17 23H7C6.17477 23 5.43324 22.5975 4.91789 22.0821C4.40255 21.5668 4 20.8252 4 20V7H3C2.44772 7 2 6.55228 2 6C2 5.44772 2.44772 5 3 5H7ZM9 4C9 3.82523 9.09745 3.56676 9.33211 3.33211C9.56676 3.09745 9.82523 3 10 3H14C14.1748 3 14.4332 3.09745 14.6679 3.33211C14.9025 3.56676 15 3.82523 15 4V5H9V4ZM6 7V20C6 20.1748 6.09745 20.4332 6.33211 20.6679C6.56676 20.9025 6.82523 21 7 21H17C17.1748 21 17.4332 20.9025 17.6679 20.6679C17.9025 20.4332 18 20.1748 18 20V7H6Z"
		/>
	</svg>
)

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
				<AddIcon />
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
				<DuplicateIcon />
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
				<TrashIcon />
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