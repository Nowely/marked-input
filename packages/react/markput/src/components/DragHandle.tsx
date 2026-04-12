import {cx, getAlwaysShowHandleDrag} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export const DragHandle = memo(({token, blockIndex}: {token: TokenType; blockIndex: number}) => {
	const store = useStore()
	const blockStore = store.blocks.get(token)

	const {readOnly, drag} = useMarkput(s => ({
		readOnly: s.props.readOnly,
		drag: s.props.drag,
	}))
	const isDragging = useMarkput(() => blockStore.state.isDragging)
	const isHovered = useMarkput(() => blockStore.state.isHovered)
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandleDrag(drag), [drag])

	if (readOnly) return null

	return (
		<div
			className={cx(
				styles.SidePanel,
				alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible
			)}
		>
			<button
				ref={(el: HTMLButtonElement | null) => blockStore.attachGrip(el, blockIndex, store.event)}
				type="button"
				draggable
				className={cx(styles.GripButton, isDragging && styles.GripButtonDragging)}
				aria-label="Drag to reorder or click for options"
			>
				<span className={iconGrip} />
			</button>
		</div>
	)
})

DragHandle.displayName = 'DragHandle'