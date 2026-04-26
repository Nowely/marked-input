import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {dom, lifecycle, isBlock, tokens, key, Component, props, structuralKey} = useMarkput(s => ({
		dom: s.dom,
		lifecycle: s.lifecycle,
		isBlock: s.slots.isBlock,
		tokens: s.parsing.tokens,
		key: s.key,
		Component: s.slots.containerComponent,
		props: s.slots.containerProps,
		structuralKey: s.dom.structuralKey,
	}))

	const setContainerRef = (element: HTMLDivElement | null) => {
		dom.refFor({role: 'container'})(element)
	}

	useLayoutEffect(() => {
		lifecycle.rendered()
	}, [lifecycle, structuralKey])

	return (
		<Component ref={setContainerRef} {...props}>
			{isBlock
				? tokens.map(t => <Block key={key.get(t)} token={t} />)
				: tokens.map(t => <Token key={key.get(t)} token={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'