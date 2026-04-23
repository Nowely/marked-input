import {memo, useLayoutEffect, useContext} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {StoreContext} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const storeCtx = useContext(StoreContext)
	if (!storeCtx) throw new Error('Store not found')
	const store = storeCtx

	const {isBlock, tokens, key, lifecycleEmit, Component, props} = useMarkput(s => ({
		isBlock: s.slots.isBlock,
		tokens: s.parsing.tokens,
		key: s.key,
		lifecycleEmit: s.lifecycle,
		Component: s.slots.containerComponent,
		props: s.slots.containerProps,
	}))

	useLayoutEffect(() => {
		lifecycleEmit.rendered()
	}, [tokens, lifecycleEmit])

	return (
		<Component ref={store.slots.container} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'