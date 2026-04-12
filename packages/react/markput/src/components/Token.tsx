import type {Token as TokenType} from '@markput/core'
import type {ComponentType} from 'react'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {TokenContext} from '../lib/providers/TokenContext'
import type {MarkProps} from '../types'

export const Token = memo(({mark}: {mark: TokenType}) => {
	const store = useStore()
	// oxlint-disable-next-line no-unsafe-type-assertion -- MarkSlot returns [unknown, unknown] in core; React-specific type asserted here
	const resolveMarkSlot = useMarkput(s => s.computed.mark) as (
		token: TokenType
	) => readonly [ComponentType<MarkProps>, MarkProps]
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