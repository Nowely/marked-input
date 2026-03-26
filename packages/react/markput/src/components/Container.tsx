import {
	resolveSlot,
	resolveSlotProps,
	getDragDropPosition,
	getDragTargetIndex,
	parseDragSourceIndex,
	getAlwaysShowHandleDrag,
} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import type {CSSProperties, DragEvent, ElementType, MouseEvent} from 'react'
import {memo, useCallback, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {BlockMenu} from './BlockMenu'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useHover(token: TokenType) {
	const blockStore = useStore().blocks.get(token)
	const isHovered = blockStore.state.isHovered.use()
	const handleMouseEnter = useCallback(() => blockStore.state.isHovered.set(true), [blockStore])
	const handleMouseLeave = useCallback(() => blockStore.state.isHovered.set(false), [blockStore])
	return {isHovered, handleMouseEnter, handleMouseLeave}
}

function useDragEvents(blockIndex: number, token: TokenType) {
	const store = useStore()
	const blockStore = store.blocks.get(token)
	const isDragging = blockStore.state.isDragging.use()
	const dropPosition = blockStore.state.dropPosition.use()

	const handleDragStart = useCallback(
		(e: DragEvent<HTMLButtonElement>) => {
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', String(blockIndex))
			blockStore.state.isDragging.set(true)
			const el = blockStore.refs.container
			if (el) e.dataTransfer.setDragImage(el, 0, 0)
		},
		[blockIndex, blockStore]
	)

	const handleDragEnd = useCallback(() => {
		blockStore.state.isDragging.set(false)
		blockStore.state.dropPosition.set(null)
	}, [blockStore])

	const handleDragOver = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			e.dataTransfer.dropEffect = 'move'
			const el = blockStore.refs.container
			if (!el) return
			blockStore.state.dropPosition.set(getDragDropPosition(e.clientY, el.getBoundingClientRect()))
		},
		[blockStore]
	)

	const handleDragLeave = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			if (e.currentTarget.contains(e.relatedTarget as Node)) return
			blockStore.state.dropPosition.set(null)
		},
		[blockStore]
	)

	const handleDrop = useCallback(
		(e: DragEvent<HTMLDivElement>) => {
			e.preventDefault()
			const sourceIndex = parseDragSourceIndex(e.dataTransfer)
			if (sourceIndex === null) return
			const targetIndex = getDragTargetIndex(blockIndex, blockStore.state.dropPosition.get() ?? 'after')
			blockStore.state.dropPosition.set(null)
			store.controllers.drag.reorder(sourceIndex, targetIndex)
		},
		[blockIndex, blockStore, store]
	)

	return {isDragging, dropPosition, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop}
}

function useBlockMenu(blockIndex: number, token: TokenType) {
	const store = useStore()
	const blockStore = store.blocks.get(token)
	const menuOpen = blockStore.state.menuOpen.use()
	const menuPosition = blockStore.state.menuPosition.use()
	const dragCtrl = store.controllers.drag

	const closeMenu = useCallback(() => blockStore.state.menuOpen.set(false), [blockStore])

	const handleGripClick = useCallback(
		(e: MouseEvent<HTMLButtonElement>) => {
			e.preventDefault()
			const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
			blockStore.state.menuPosition.set({top: rect.bottom + 4, left: rect.left})
			blockStore.state.menuOpen.set(true)
		},
		[blockStore]
	)

	const handleAdd = useCallback(() => {
		dragCtrl.add(blockIndex)
		closeMenu()
	}, [blockIndex, dragCtrl, closeMenu])
	const handleDelete = useCallback(() => {
		dragCtrl.delete(blockIndex)
		closeMenu()
	}, [blockIndex, dragCtrl, closeMenu])
	const handleDuplicate = useCallback(() => {
		dragCtrl.duplicate(blockIndex)
		closeMenu()
	}, [blockIndex, dragCtrl, closeMenu])

	return {menuOpen, menuPosition, handleGripClick, handleAdd, handleDelete, handleDuplicate, closeMenu}
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ContainerProps {
	tokens: TokenType[]
	// Root mode
	containerRef?: (el: HTMLDivElement | null) => void
	className?: string
	style?: CSSProperties
	// Drag block mode (blockIndex presence activates it)
	blockIndex?: number
}

export const Container = memo(({tokens, containerRef, className, style, blockIndex}: ContainerProps) => {
	const store = useStore()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const readOnly = store.state.readOnly.use()
	const drag = store.state.drag.use()
	const key = store.key

	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandleDrag(drag), [drag])

	// Hooks always called (React rules) — token[0] used as stable key for block stores
	const token = tokens[0]
	const {isHovered, handleMouseEnter, handleMouseLeave} = useHover(token)
	const {isDragging, dropPosition, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop} =
		useDragEvents(blockIndex ?? 0, token)
	const {menuOpen, menuPosition, handleGripClick, handleAdd, handleDelete, handleDuplicate, closeMenu} = useBlockMenu(
		blockIndex ?? 0,
		token
	)

	// — Drag block mode —
	if (blockIndex !== undefined) {
		return (
			<ContainerComponent
				ref={(el: HTMLElement | null) => {
					store.blocks.get(token).refs.container = el
				}}
				data-testid="block"
				{...containerProps}
				className={styles.Block}
				style={{opacity: isDragging ? 0.4 : 1}}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={handleDrop}
			>
				{dropPosition === 'before' && <div className={styles.DropIndicator} style={{top: -1}} />}

				{!readOnly && (
					<div
						className={styles.SidePanel}
						style={{
							left: readOnly ? 0 : -24,
							opacity: alwaysShowHandle || (isHovered && !isDragging) ? 1 : 0,
							transition: alwaysShowHandle ? undefined : 'opacity 0.15s ease',
							pointerEvents: alwaysShowHandle || isHovered ? 'auto' : 'none',
						}}
					>
						<button
							type="button"
							draggable
							onDragStart={handleDragStart}
							onDragEnd={handleDragEnd}
							onClick={handleGripClick}
							className={styles.GripButton}
							style={{cursor: isDragging ? 'grabbing' : 'grab'}}
							aria-label="Drag to reorder or click for options"
						>
							<span className={iconGrip} />
						</button>
					</div>
				)}

				{tokens.map(t => (
					<Token key={key.get(t)} mark={t} />
				))}

				{dropPosition === 'after' && <div className={styles.DropIndicator} style={{bottom: -1}} />}

				{menuOpen && (
					<BlockMenu
						position={menuPosition}
						onAdd={handleAdd}
						onDelete={handleDelete}
						onDuplicate={handleDuplicate}
						onClose={closeMenu}
					/>
				)}
			</ContainerComponent>
		)
	}

	// — Normal / root mode —
	return (
		<ContainerComponent ref={containerRef} {...containerProps} className={className} style={style}>
			{tokens.map(t => (
				<Token key={key.get(t)} mark={t} />
			))}
		</ContainerComponent>
	)
})

Container.displayName = 'Container'