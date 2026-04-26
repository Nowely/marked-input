import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'

export const Token = memo(({token}: {token: TokenType}) => {
	const {resolveMarkSlot, key, index, store} = useMarkput(s => ({
		resolveMarkSlot: s.mark.slot,
		key: s.key,
		index: s.parsing.index,
		store: s,
	}))
	const path = index.pathFor(token)
	const address = path ? index.addressFor(path) : undefined
	if (!address) return null

	const [Component, props] = resolveMarkSlot(token)
	const children =
		token.type === 'mark' && token.children.length > 0
			? token.children.map(child => <Token key={key.get(child)} token={child} />)
			: undefined

	return (
		<TokenContext value={{store, token, address}}>
			{children ? <Component {...props}>{children}</Component> : <Component {...props} />}
		</TokenContext>
	)
})

Token.displayName = 'Token'