import type {ElementType} from 'react'
import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const store = useStore()

	const {drag, tokens} = useMarkput(s => ({
		drag: s.props.drag,
		tokens: s.state.tokens,
	}))

	// oxlint-disable-next-line no-unsafe-type-assertion -- containerComponent returns unknown in core; React ElementType asserted here
	const Component = useMarkput(s => s.computed.containerComponent) as ElementType
	const props = useMarkput(s => s.computed.containerProps)

	useLayoutEffect(() => {
		store.event.afterTokensRendered()
	}, [tokens])

	const key = store.key
	const refs = store.refs

	return (
		<Component ref={(el: HTMLDivElement | null) => (refs.container = el)} {...props}>
			{drag
				? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'