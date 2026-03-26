import {getAlwaysShowHandleDrag} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export const DragHandle = memo(({token, blockIndex}: {token: TokenType; blockIndex: number}) => {
	const store = useStore()
	const readOnly = store.state.readOnly.use()
	const drag = store.state.drag.use()
	const blockStore = store.blocks.get(token)
	const isDragging = blockStore.state.isDragging.use()
	const isHovered = blockStore.state.isHovered.use()
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandleDrag(drag), [drag])

	if (readOnly) return null

	return (
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
				ref={(el: HTMLButtonElement | null) => blockStore.attachGrip(el, blockIndex, store.controllers.drag)}
				type="button"
				draggable
				className={styles.GripButton}
				style={{cursor: isDragging ? 'grabbing' : 'grab'}}
				aria-label="Drag to reorder or click for options"
			>
				<span className={iconGrip} />
			</button>
		</div>
	)
})

DragHandle.displayName = 'DragHandle'