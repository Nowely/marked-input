import type {MarkToken, Token as TokenType} from '@markput/core'
import {memo, useLayoutEffect, useRef} from 'react'

import {useSlot} from '../lib/hooks/useSlot'
import {useStore} from '../lib/providers/StoreContext'
import {TokenContext, useToken} from '../lib/providers/TokenContext'
import type {MarkProps} from '../types'

export const Token = memo(({mark}: {mark: TokenType}) => {
	return (
		<TokenContext value={mark}>{mark.type === 'mark' ? <MarkTokenRenderer /> : <TextTokenRenderer />}</TokenContext>
	)
})

Token.displayName = 'Token'

const TextTokenRenderer = memo(() => {
	const token = useToken()
	const ref = useRef<HTMLSpanElement>(null)

	const [SpanComponent, spanProps] = useSlot('span')

	if (token.type !== 'text') {
		throw new Error('TextTokenRenderer expects a TextToken')
	}

	useLayoutEffect(() => {
		if (ref.current && ref.current.textContent !== token.content) {
			ref.current.textContent = token.content
		}
	}, [token.content])

	return <SpanComponent {...spanProps} ref={ref} />
})

TextTokenRenderer.displayName = 'TextTokenRenderer'

const MarkTokenRenderer = memo(() => {
	const node = useToken() as MarkToken
	const store = useStore()
	const options = store.state.options.use()
	const key = store.key

	const option = options?.[node.descriptor.index]

	const children = node.children.map(child => <Token key={key.get(child)} mark={child} />)

	const markPropsData: MarkProps = {
		value: node.value,
		meta: node.meta,
		children: node.children.length > 0 ? children : undefined,
	}

	const [Mark, props] = useSlot('mark', option, markPropsData)

	return <Mark {...props} />
})

MarkTokenRenderer.displayName = 'MarkTokenRenderer'