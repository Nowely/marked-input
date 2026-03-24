import type {Token as TokenType} from '@markput/core'
import {memo} from 'react'

import {useTokenSlot} from '../lib/hooks/useSlot'
import {useStore} from '../lib/providers/StoreContext'
import {TokenContext} from '../lib/providers/TokenContext'

export const Token = memo(({mark}: {mark: TokenType}) => {
	const store = useStore()
	const [Component, props] = useTokenSlot(mark)

	const children =
		mark.type === 'mark' && mark.children.length > 0
			? mark.children.map(child => <Token key={store.key.get(child)} mark={child} />)
			: undefined

	return (
		<TokenContext value={mark}>
			<Component {...props} children={children} />
		</TokenContext>
	)
})

Token.displayName = 'Token'