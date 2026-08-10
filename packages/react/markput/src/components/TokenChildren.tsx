import type {CSSProperties, ReactNode} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

const sequenceHostStyle: CSSProperties = {display: 'contents'}

/** `ownerId` is the owning mark's stable id — the key `tokens.children` registers under since S1.8. */
export const TokenChildren = memo(({ownerId, children}: {ownerId: number; children: ReactNode}) => {
	const {tokens} = useMarkput(s => ({tokens: s.tokens}))
	const ref = useMemo(() => tokens.children(ownerId), [tokens, ownerId])

	return (
		<span ref={ref} style={sequenceHostStyle}>
			{children}
		</span>
	)
})

TokenChildren.displayName = 'TokenChildren'