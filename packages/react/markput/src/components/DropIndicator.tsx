import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

export const DropIndicator = memo(
	({token, blockIndex, position}: {token: TokenType; blockIndex: number; position: 'before' | 'after'}) => {
		const dropPosition = useMarkput(s => s.block.get(token).state.dropPosition)
		const {tokens} = useMarkput(s => ({tokens: s.tokens}))
		// A row's path is its block index by construction.
		const controlRef = useMemo(() => tokens.control([blockIndex]), [tokens, blockIndex])

		if (dropPosition !== position) return null

		return (
			<div
				ref={controlRef}
				className={styles.DropIndicator}
				style={position === 'before' ? {top: -1} : {bottom: -1}}
			/>
		)
	}
)

DropIndicator.displayName = 'DropIndicator'