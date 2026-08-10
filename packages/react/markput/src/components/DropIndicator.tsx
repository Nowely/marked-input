import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

export const DropIndicator = memo(({token, position}: {token: TokenType; position: 'before' | 'after'}) => {
	const {dropPosition, tokens} = useMarkput(s => ({
		dropPosition: s.block.get(token).state.dropPosition,
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