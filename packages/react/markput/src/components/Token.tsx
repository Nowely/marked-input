import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'

export const Token = memo(({token}: {token: TokenType}) => {
	const {resolveMarkSlot, index, dom, readOnly, store} = useMarkput(s => ({
		resolveMarkSlot: s.mark.slot,
		index: s.parsing.index,
		dom: s.dom,
		readOnly: s.props.readOnly,
		store: s,
	}))
	const path = index.pathFor(token)
	if (!path) return null

	if (token.type === 'text') {
		const [Span, props] = resolveMarkSlot(token)
		const textSurface = (
			<span ref={dom.refFor({role: 'text', path})} contentEditable={!readOnly} suppressContentEditableWarning>
				{token.content}
			</span>
		)

		return (
			<span ref={dom.refFor({role: 'token', path})}>
				<Span {...props}>{textSurface}</Span>
			</span>
		)
	}

	const [Component, props] = resolveMarkSlot(token)
	const children =
		token.children.length > 0 ? (
			<span ref={dom.refFor({role: 'slotRoot', path})}>
				{token.children.map(child => (
					<Token key={index.key(index.pathFor(child) ?? [])} token={child} />
				))}
			</span>
		) : undefined

	return (
		<TokenContext value={{store, token, address: index.addressFor(path)}}>
			<span ref={dom.refFor({role: 'token', path})}>
				<Component children={children} {...props} />
			</span>
		</TokenContext>
	)
})

Token.displayName = 'Token'