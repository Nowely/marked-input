import {memo, useLayoutEffect, useContext} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {StoreContext} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const storeCtx = useContext(StoreContext)
	if (!storeCtx) throw new Error('Store not found')
	const store = storeCtx

	const {isBlock, tokens, key, Component, props, structuralKey} = useMarkput(s => ({
		isBlock: s.slots.isBlock,
		tokens: s.parsing.tokens,
		key: s.key,
		Component: s.slots.containerComponent,
		props: s.slots.containerProps,
		structuralKey: s.dom.structuralKey,
	}))

	const setContainerRef = (element: HTMLDivElement | null) => {
		store.slots.container(element)
		store.dom.refFor({role: 'container'})(element)
	}

	useLayoutEffect(() => {
		store.lifecycle.rendered()
	}, [store, structuralKey])

	return (
		<Component ref={setContainerRef} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} token={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'