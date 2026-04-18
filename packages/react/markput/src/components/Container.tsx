import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {layout, tokens, key, state, event, Component, props} = useMarkput(s => ({
		layout: s.props.layout,
		tokens: s.state.tokens,
		key: s.key,
		state: s.state,
		event: s.event,
		Component: s.computed.containerComponent,
		props: s.computed.containerProps,
	}))

	useLayoutEffect(() => {
		event.afterTokensRendered()
	}, [tokens, event])

	return (
		<Component ref={state.container} {...props}>
			{layout === 'block'
				? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'