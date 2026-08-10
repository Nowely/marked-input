import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'
import {TokenChildren} from './TokenChildren'

/**
 * `depth` arrives by construction: the parent that maps the tree knows it. The render-time
 * `TokenPath` that used to travel alongside it went at S1.8 step 4 — its last reader was
 * `TokenChildren`, which now registers under the owner's stable id.
 */
export const Token = memo(({token, depth}: {token: TokenType; depth: number}) => {
	const {resolveMarkSlot, keyOf, store} = useMarkput(s => ({
		resolveMarkSlot: s.slots.mark,
		keyOf: s.tokens.keyOf,
		store: s,
	}))

	const [Component, props] = resolveMarkSlot(token)
	const children =
		token.type === 'mark' && token.children.length > 0 ? (
			<TokenChildren ownerId={keyOf(token)}>
				{token.children.map(child => (
					<Token key={keyOf(child)} token={child} depth={depth + 1} />
				))}
			</TokenChildren>
		) : undefined

	return (
		<TokenContext value={{store, token, depth}}>
			{children ? <Component {...props}>{children}</Component> : <Component {...props} />}
		</TokenContext>
	)
})

Token.displayName = 'Token'