import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

export const DropIndicator = memo(({token, position}: {token: TokenType; position: 'before' | 'after'}) => {
	const dropPosition = useMarkput(s => s.blocks.get(token).state.dropPosition)

	if (dropPosition !== position) return null

	return <div className={styles.DropIndicator} style={position === 'before' ? {top: -1} : {bottom: -1}} />
})

DropIndicator.displayName = 'DropIndicator'