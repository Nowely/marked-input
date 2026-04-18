import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {TokenContext} from '../lib/providers/TokenContext'

export const Token = memo(({mark}: {mark: TokenType}) => {
	const store = useStore()
	const resolveMarkSlot = useMarkput(s => s.computed.mark)
	const [Component, props] = resolveMarkSlot(mark)

	const children =
		mark.type === 'mark' && mark.children.length > 0
			? mark.children.map(child => <Token key={store.key.get(child)} mark={child} />)
			: undefined

	return (
		<TokenContext value={mark}>
			<Component children={children} {...props} />
		</TokenContext>
	)
})

Token.displayName = 'Token'