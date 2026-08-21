import {cx, getAlwaysShowHandle} from '@markput/core'
import type {TreeNode} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export const DragHandle = memo(({node}: {node: TreeNode}) => {
	const {blockStore, readOnly, draggable, isDragging, isHovered, tokens} = useMarkput(s => {
		const blockStore = s.block.get(node)

		return {
			blockStore,
			readOnly: s.props.readOnly,
			draggable: s.props.draggable,
			isDragging: blockStore.state.isDragging,
			isHovered: blockStore.state.isHovered,
			tokens: s.tokens,
		}
	})
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandle(draggable), [draggable])
	const controlRef = useMemo(() => tokens.control(), [tokens])

	if (readOnly) return null

	return (
		<div
			ref={controlRef}
			className={cx(
				styles.SidePanel,
				alwaysShowHandle ? styles.SidePanelAlways : isHovered && !isDragging && styles.SidePanelVisible
			)}
		>
			<button
				ref={(el: HTMLButtonElement | null) => {
					blockStore.attachGrip(el)
				}}
				type="button"
				// The grip is also the menu trigger, so it renders in block mode regardless;
				// `draggable` gates only the drag affordance it carries.
				draggable={!!draggable}
				className={cx(styles.GripButton, isDragging && styles.GripButtonDragging)}
				aria-label={draggable ? 'Drag to reorder or click for options' : 'Block options'}
			>
				<span className={iconGrip} />
			</button>
		</div>
	)
})

DragHandle.displayName = 'DragHandle'