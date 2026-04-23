import type {Store} from '@markput/core'
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
		isBlock: s.feature.slots.isBlock,
		tokens: s.feature.parsing.state.tokens,
		key: s.key,
		lifecycleEmit: s.feature.lifecycle,
		Component: s.feature.slots.containerComponent,
		props: s.feature.slots.containerProps,
	}))

	useLayoutEffect(() => {
		lifecycleEmit.rendered()
	}, [tokens, lifecycleEmit])

	return (
		<Component ref={store.feature.slots.container} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'