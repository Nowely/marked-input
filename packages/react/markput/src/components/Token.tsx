import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'

export const Token = memo(({mark}: {mark: TokenType}) => {
	const {resolveMarkSlot, key} = useMarkput(s => ({
		resolveMarkSlot: s.computed.mark,
		key: s.key,
	}))
	const [Component, props] = resolveMarkSlot(mark)

	const children =
		mark.type === 'mark' && mark.children.length > 0
			? mark.children.map(child => <Token key={key.get(child)} mark={child} />)
			: undefined

	return (
		<TokenContext value={mark}>
			<Component children={children} {...props} />
		</TokenContext>
	)
})

Token.displayName = 'Token'