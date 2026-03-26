import {resolveSlot, resolveSlotProps, getAlwaysShowHandleDrag} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import type {CSSProperties, ElementType} from 'react'
import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {BlockMenu} from './BlockMenu'
import {Token} from './Token'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

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

	const token = tokens[0]
	const blockStore = store.blocks.get(token)

	// State subscriptions — for rendering only
	const isDragging = blockStore.state.isDragging.use()
	const dropPosition = blockStore.state.dropPosition.use()
	const isHovered = blockStore.state.isHovered.use()
	const menuOpen = blockStore.state.menuOpen.use()
	const menuPosition = blockStore.state.menuPosition.use()

	// — Drag block mode —
	if (blockIndex !== undefined) {
		return (
			<ContainerComponent
				ref={(el: HTMLElement | null) => blockStore.attachContainer(el, blockIndex, store.controllers.drag)}
				data-testid="block"
				{...containerProps}
				className={styles.Block}
				style={{opacity: isDragging ? 0.4 : 1}}
			>
				{dropPosition === 'before' && <div className={styles.DropIndicator} style={{top: -1}} />}

				{!readOnly && (
					<div
						className={styles.SidePanel}
						style={{
							left: -24,
							opacity: alwaysShowHandle || (isHovered && !isDragging) ? 1 : 0,
							transition: alwaysShowHandle ? undefined : 'opacity 0.15s ease',
							pointerEvents: alwaysShowHandle || isHovered ? 'auto' : 'none',
						}}
					>
						<button
							ref={(el: HTMLButtonElement | null) =>
								blockStore.attachGrip(el, blockIndex, store.controllers.drag)
							}
							type="button"
							draggable
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
						onAdd={blockStore.addBlock}
						onDelete={blockStore.deleteBlock}
						onDuplicate={blockStore.duplicateBlock}
						onClose={blockStore.closeMenu}
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