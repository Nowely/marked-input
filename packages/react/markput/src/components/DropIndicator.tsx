import type {Token as TokenType} from '@markput/core'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

import styles from '@markput/core/styles.module.css'

export const DropIndicator = memo(({token, position}: {token: TokenType; position: 'before' | 'after'}) => {
	const dropPosition = useMarkput(s => s.block.get(token).state.dropPosition)
	const {refs, index} = useMarkput(s => ({refs: s.refs, index: s.tokens.index}))
	const path = index.pathFor(token)
	const controlRef = useMemo(() => (path ? refs.control(path) : undefined), [refs, path])

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