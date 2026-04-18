import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {isBlock, tokens, key, state, event, Component, props} = useMarkput(s => ({
		isBlock: s.computed.isBlock,
		tokens: s.state.tokens,
		key: s.key,
		state: s.state,
		event: s.event,
		Component: s.computed.containerComponent,
		props: s.computed.containerProps,
	}))

	useLayoutEffect(() => {
		event.rendered()
	}, [tokens, event])

	return (
		<Component ref={state.container} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'