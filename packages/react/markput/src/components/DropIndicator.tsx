import type {TreeNode} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

export const DropIndicator = memo(({node, position}: {node: TreeNode; position: 'before' | 'after'}) => {
	const {dropPosition, tokens} = useMarkput(s => ({
		dropPosition: s.block.get(node).state.dropPosition,
		tokens: s.tokens,
	}))
	const controlRef = useMemo(() => tokens.control(), [tokens])

	if (dropPosition !== position) return null

	return (
		<div
			ref={controlRef}
			className={styles.DropIndicator}
			style={position === 'before' ? {top: -1} : {bottom: -1}}
		/>
	)
})

DropIndicator.displayName = 'DropIndicator'