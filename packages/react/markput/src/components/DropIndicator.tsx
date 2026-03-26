import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useStore} from '../lib/providers/StoreContext'

import styles from '@markput/core/styles.module.css'

export const DropIndicator = memo(({token, position}: {token: TokenType; position: 'before' | 'after'}) => {
	const blockStore = useStore().blocks.get(token)
	const dropPosition = blockStore.state.dropPosition.use()

	if (dropPosition !== position) return null

	return <div className={styles.DropIndicator} style={position === 'before' ? {top: -1} : {bottom: -1}} />
})

DropIndicator.displayName = 'DropIndicator'