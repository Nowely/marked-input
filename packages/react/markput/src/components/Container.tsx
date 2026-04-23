import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {isBlock, tokens, key, slotsState, lifecycleEmit, Component, props} = useMarkput(s => ({
		isBlock: s.feature.slots.computed.isBlock,
		tokens: s.feature.parsing.state.tokens,
		key: s.key,
		slotsState: s.feature.slots.state,
		lifecycleEmit: s.feature.lifecycle,
		Component: s.feature.slots.computed.containerComponent,
		props: s.feature.slots.computed.containerProps,
	}))

	useLayoutEffect(() => {
		lifecycleEmit.rendered()
	}, [tokens, lifecycleEmit])

	return (
		<Component ref={slotsState.container} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'