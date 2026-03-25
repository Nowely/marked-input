import {
	resolveSlot,
	resolveSlotProps,
	filterDragTokens,
	getAlwaysShowHandleDrag,
	getDirectChildIndex,
	EMPTY_TEXT_TOKEN,
} from '@markput/core'
import type {DragEvent, ElementType, MouseEvent} from 'react'
import {memo, useCallback, useMemo, useRef, useState} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {BlockMenu} from './BlockMenu'
import {DragMark, type MenuPosition} from './DragMark'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

interface MenuState {
	index: number
	position: MenuPosition
}

export const DragContainer = memo(() => {
	const store = useStore()
	const tokens = store.state.tokens.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const className = store.state.className.use()
	const style = store.state.style.use()
	const readOnly = store.state.readOnly.use()
	const drag = store.state.drag.use()
	const alwaysShowHandle = getAlwaysShowHandleDrag(drag)
	const key = store.key
	const refs = store.refs
	const dragCtrl = store.controllers.drag

	const [menuState, setMenuState] = useState<MenuState | null>(null)
	const [hoveredMarkIndex, setHoveredMarkIndex] = useState<number | null>(null)
	const [markDragSource, setMarkDragSource] = useState<number | null>(null)
	const [markDropTarget, setMarkDropTarget] = useState<{index: number; position: 'before' | 'after'} | null>(null)
	const markGripRef = useRef<HTMLButtonElement>(null)
	const hideMarkGripTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	const rows = useMemo(() => {
		const result = filterDragTokens(tokens)
		return result.length > 0 ? result : [EMPTY_TEXT_TOKEN]
	}, [tokens])

	const handleAdd = useCallback((afterIndex: number) => dragCtrl.add(afterIndex), [dragCtrl])

	const handleRequestMenu = useCallback((index: number, rect: DOMRect) => {
		setMenuState({index, position: {top: rect.bottom + 4, left: rect.left}})
	}, [])

	const closeMenu = useCallback(() => setMenuState(null), [])

	const scheduleHideMarkGrip = useCallback(() => {
		if (hideMarkGripTimerRef.current) clearTimeout(hideMarkGripTimerRef.current)
		hideMarkGripTimerRef.current = setTimeout(() => setHoveredMarkIndex(null), 120)
	}, [])

	const cancelHideMarkGrip = useCallback(() => {
		if (hideMarkGripTimerRef.current) clearTimeout(hideMarkGripTimerRef.current)
	}, [])

	const handleContainerMouseOver = useCallback(
		(e: MouseEvent<HTMLElement>) => {
			const container = refs.container
			if (!container) return
			const childIndex = getDirectChildIndex(container, e.target)
			if (childIndex === -1 || rows[childIndex]?.type !== 'mark') {
				scheduleHideMarkGrip()
				return
			}
			cancelHideMarkGrip()
			setHoveredMarkIndex(childIndex)
		},
		[refs, rows, scheduleHideMarkGrip, cancelHideMarkGrip]
	)

	const handleContainerMouseLeave = useCallback(() => scheduleHideMarkGrip(), [scheduleHideMarkGrip])

	const handleContainerDragOver = useCallback(
		(e: DragEvent<HTMLElement>) => {
			const container = refs.container
			if (!container) return
			const childIndex = getDirectChildIndex(container, e.target)
			if (childIndex === -1 || rows[childIndex]?.type !== 'mark') return
			e.preventDefault()
			const el = container.children[childIndex] as HTMLElement
			const rect = el.getBoundingClientRect()
			const mid = rect.left + rect.width / 2
			setMarkDropTarget({index: childIndex, position: e.clientX < mid ? 'before' : 'after'})
		},
		[refs, rows]
	)

	const handleContainerDragLeave = useCallback(
		(e: DragEvent<HTMLElement>) => {
			if (!refs.container) return
			if (refs.container.contains(e.relatedTarget as Node)) return
			setMarkDropTarget(null)
		},
		[refs]
	)

	const handleContainerDrop = useCallback(
		(e: DragEvent<HTMLElement>) => {
			if (!markDropTarget) return
			e.preventDefault()
			const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10)
			if (isNaN(sourceIndex)) return
			const targetIndex = markDropTarget.position === 'before' ? markDropTarget.index : markDropTarget.index + 1
			setMarkDropTarget(null)
			dragCtrl.reorder(sourceIndex, targetIndex)
		},
		[markDropTarget, dragCtrl]
	)

	const handleMarkGripDragStart = useCallback(
		(e: DragEvent<HTMLButtonElement>) => {
			if (hoveredMarkIndex === null || !refs.container) return
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', String(hoveredMarkIndex))
			setMarkDragSource(hoveredMarkIndex)
			const el = refs.container.children[hoveredMarkIndex] as HTMLElement
			if (el) e.dataTransfer.setDragImage(el, 0, 0)
		},
		[hoveredMarkIndex, refs]
	)

	const handleMarkGripDragEnd = useCallback(() => {
		setMarkDragSource(null)
		setMarkDropTarget(null)
	}, [])

	return (
		<>
			<ContainerComponent
				ref={(el: HTMLDivElement | null) => (refs.container = el)}
				{...containerProps}
				className={className}
				style={readOnly ? style : {paddingLeft: 24, ...style}}
				onMouseOver={handleContainerMouseOver}
				onMouseLeave={handleContainerMouseLeave}
				onDragOver={handleContainerDragOver}
				onDragLeave={handleContainerDragLeave}
				onDrop={handleContainerDrop}
			>
				{rows.map((token, index) =>
					token.type === 'mark' ? (
						<Token key={key.get(token)} mark={token} />
					) : (
						<DragMark
							key={key.get(token)}
							blockIndex={index}
							readOnly={readOnly}
							alwaysShowHandle={alwaysShowHandle}
							onReorder={(s, t) => dragCtrl.reorder(s, t)}
							onRequestMenu={handleRequestMenu}
						>
							<Token key={key.get(token)} mark={token} />
						</DragMark>
					)
				)}
			</ContainerComponent>
			{hoveredMarkIndex !== null &&
				!readOnly &&
				(() => {
					const el = refs.container?.children[hoveredMarkIndex] as HTMLElement | undefined
					const rect = el?.getBoundingClientRect()
					if (!rect) return null
					return (
						<button
							ref={markGripRef}
							type="button"
							draggable
							onDragStart={handleMarkGripDragStart}
							onDragEnd={handleMarkGripDragEnd}
							onMouseEnter={cancelHideMarkGrip}
							onMouseLeave={scheduleHideMarkGrip}
							onClick={e => {
								e.preventDefault()
								if (markGripRef.current)
									handleRequestMenu(hoveredMarkIndex, markGripRef.current.getBoundingClientRect())
							}}
							style={{
								position: 'fixed',
								top: rect.top + rect.height / 2 - 12,
								left: rect.left - 24,
								width: 24,
								height: 24,
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								cursor: markDragSource !== null ? 'grabbing' : 'grab',
								borderRadius: 4,
								color: '#9ca3af',
								background: 'none',
								border: 'none',
								padding: 0,
								zIndex: 100,
								pointerEvents: 'auto',
								userSelect: 'none',
							}}
							aria-label="Drag to reorder or click for options"
						>
							<span className={iconGrip} />
						</button>
					)
				})()}
			{markDropTarget !== null &&
				(() => {
					const el = refs.container?.children[markDropTarget.index] as HTMLElement | undefined
					const rect = el?.getBoundingClientRect()
					if (!rect) return null
					const x = markDropTarget.position === 'before' ? rect.left - 1 : rect.right - 1
					return (
						<div
							style={{
								position: 'fixed',
								left: x,
								top: rect.top,
								width: 2,
								height: rect.height,
								backgroundColor: '#3b82f6',
								borderRadius: 1,
								pointerEvents: 'none',
								zIndex: 10,
							}}
						/>
					)
				})()}
			{menuState && (
				<BlockMenu
					position={menuState.position}
					onAdd={() => {
						handleAdd(menuState.index)
						closeMenu()
					}}
					onDelete={() => {
						dragCtrl.delete(menuState.index)
						closeMenu()
					}}
					onDuplicate={() => {
						dragCtrl.duplicate(menuState.index)
						closeMenu()
					}}
					onClose={closeMenu}
				/>
			)}
		</>
	)
})

DragContainer.displayName = 'DragContainer'