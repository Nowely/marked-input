import {cx, getAlwaysShowHandle} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

const iconGrip = `${styles.Icon} ${styles.IconGrip}`

export const DragHandle = memo(({token, blockIndex}: {token: TokenType; blockIndex: number}) => {
	const {blockStore, action, readOnly, draggable, isDragging, isHovered, tokens} = useMarkput(s => {
		const blockStore = s.block.get(token)

		return {
			blockStore,
			action: s.block.action,
			readOnly: s.props.readOnly,
			draggable: s.props.draggable,
			isDragging: blockStore.state.isDragging,
			isHovered: blockStore.state.isHovered,
			tokens: s.tokens,
		}
	})
	const alwaysShowHandle = useMemo(() => getAlwaysShowHandle(draggable), [draggable])
	// A row's path is its block index by construction.
	const controlRef = useMemo(() => tokens.control([blockIndex]), [tokens, blockIndex])

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
					blockStore.attachGrip(el, blockIndex, {action})
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