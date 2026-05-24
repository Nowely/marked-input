import type {TokenPath} from '@markput/core'
import type {CSSProperties, ReactNode} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'

const sequenceHostStyle: CSSProperties = {display: 'contents'}

export const TokenChildren = memo(({ownerPath, children}: {ownerPath: TokenPath; children: ReactNode}) => {
	const {bridge} = useMarkput(s => ({bridge: s.bridge}))
	const ref = useMemo(() => bridge.childrenFor(ownerPath), [bridge, ownerPath])

	return (
		<span ref={ref} style={sequenceHostStyle}>
			{children}
		</span>
	)
})

TokenChildren.displayName = 'TokenChildren'