import type {Token as TokenType, TokenPath} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'
import {TokenChildren} from './TokenChildren'

/**
 * `path` arrives by construction: the parent that maps the tree knows every
 * child's index, so no per-token lookup is needed — and none would work here,
 * since during a structural render the freshly published tree is not bound to
 * the node layer yet.
 */
export const Token = memo(({token, path}: {token: TokenType; path: TokenPath}) => {
	const {resolveMarkSlot, key, store} = useMarkput(s => ({
		resolveMarkSlot: s.slots.mark,
		key: s.key,
		store: s,
	}))

	const [Component, props] = resolveMarkSlot(token)
	const children =
		token.type === 'mark' && token.children.length > 0 ? (
			<TokenChildren ownerPath={path}>
				{token.children.map((child, i) => (
					<Token key={key.get(child)} token={child} path={[...path, i]} />
				))}
			</TokenChildren>
		) : undefined

	return (
		<TokenContext value={{store, token, address: {path, token}}}>
			{children ? <Component {...props}>{children}</Component> : <Component {...props} />}
		</TokenContext>
	)
})

Token.displayName = 'Token'