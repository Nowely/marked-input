import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

export const DropIndicator = memo(({token, position}: {token: TokenType; position: 'before' | 'after'}) => {
	const dropPosition = useMarkput(s => s.block.get(token).state.dropPosition)
	const {tokens, index} = useMarkput(s => ({tokens: s.tokens, index: s.tokens.structureIndex}))
	const path = index.pathFor(token)
	const controlRef = useMemo(() => (path ? tokens.control(path) : undefined), [tokens, path])

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