import type {TokenPath} from '@markput/core'
import type {CSSProperties, ReactNode} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

const sequenceHostStyle: CSSProperties = {display: 'contents'}

export const TokenChildren = memo(({ownerPath, children}: {ownerPath: TokenPath; children: ReactNode}) => {
	const {refs} = useMarkput(s => ({refs: s.refs}))
	const ref = useMemo(() => refs.children(ownerPath), [refs, ownerPath])

	return (
		<span ref={ref} style={sequenceHostStyle}>
			{children}
		</span>
	)
})

TokenChildren.displayName = 'TokenChildren'