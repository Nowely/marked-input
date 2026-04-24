import {cx, getAlwaysShowHandle} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export const DragHandle = memo(({token, blockIndex}: {token: TokenType; blockIndex: number}) => {
	const {blockStore, action, readOnly, draggable, isDragging, isHovered} = useMarkput(s => ({
		blockStore: s.blocks.get(token),
		action: s.drag.action,
		readOnly: s.props.readOnly,
		draggable: s.props.draggable,
		isDragging: s.blocks.get(token).state.isDragging,
		isHovered: s.blocks.get(token).state.isHovered,
	}))
	const {store, index} = useMarkput(s => ({store: s, index: s.parsing.index}))
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandle(draggable), [draggable])
	const path = index.pathFor(token)
	const controlRef = path ? store.dom.refFor({role: 'control', ownerPath: path}) : undefined

	if (readOnly) return null

	return (
		<div
			className={cx(
				styles.SidePanel,
				alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible
			)}
		>
			<button
				ref={(el: HTMLButtonElement | null) => {
					blockStore.attachGrip(el, blockIndex, {action})
					controlRef?.(el)
				}}
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