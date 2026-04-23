import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {isBlock, tokens, key, state, lifecycleEmit, Component, props} = useMarkput(s => ({
		isBlock: s.computed.isBlock,
		tokens: s.state.tokens,
		key: s.key,
		state: s.state,
		lifecycleEmit: s.feature.lifecycle.emit,
		Component: s.computed.containerComponent,
		props: s.computed.containerProps,
	}))

	useLayoutEffect(() => {
		lifecycleEmit.rendered()
	}, [tokens, lifecycleEmit])

	return (
		<Component ref={state.container} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'