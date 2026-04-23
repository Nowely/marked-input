import {cx, getAlwaysShowHandle} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export const DragHandle = memo(({token, blockIndex}: {token: TokenType; blockIndex: number}) => {
	const {blockStore, drag, readOnly, draggable, isDragging, isHovered} = useMarkput(s => ({
		blockStore: s.blocks.get(token),
		drag: s.drag.drag,
		readOnly: s.props.readOnly,
		draggable: s.props.draggable,
		isDragging: s.blocks.get(token).state.isDragging,
		isHovered: s.blocks.get(token).state.isHovered,
	}))
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandle(draggable), [draggable])

	if (readOnly) return null

	return (
		<div
			className={cx(
				styles.SidePanel,
				alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible
			)}
		>
			<button
				ref={(el: HTMLButtonElement | null) => blockStore.attachGrip(el, blockIndex, {drag})}
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