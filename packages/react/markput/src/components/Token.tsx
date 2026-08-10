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
/**
 * `position` is the only field an edit BEFORE a token changes: the snapshot re-materializes
 * the surviving suffix with shifted offsets while `content`/`value`/`meta`/`descriptor` stay
 * reference-equal. Nothing downstream of here reads `position` (nor `slot`, whose offsets
 * shift with it), so `memo`'s default reference compare re-rendered every mark after the
 * caret for nothing — 101 Mark renders on a head insert at 100 marks, 1 with this.
 */
const sameToken = (a: TokenType, b: TokenType): boolean => {
	if (a === b) return true
	if (a.id !== b.id || a.type !== b.type || a.content !== b.content) return false
	if (a.type !== 'mark' || b.type !== 'mark') return true
	return (
		a.value === b.value &&
		a.meta === b.meta &&
		a.descriptor === b.descriptor &&
		a.children.length === b.children.length &&
		a.children.every((child, index) => sameToken(child, b.children[index]))
	)
}

export const Token = memo(
	({token, depth}: {token: TokenType; depth: number}) => {
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
	},
	(prev, next) => prev.depth === next.depth && sameToken(prev.token, next.token)
)

Token.displayName = 'Token'