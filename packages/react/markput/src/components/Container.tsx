import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {host, isBlock, tokens, key, Component, props} = useMarkput(s => ({
		host: s.host,
		isBlock: s.props.layout.isBlock,
		tokens: s.tokens.structure,
		key: s.key,
		Component: s.slots.containerComponent,
		props: s.slots.containerProps,
	}))

	useLayoutEffect(() => {
		host.rendered()
	})

	return (
		<Component ref={host.container} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} token={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'