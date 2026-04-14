import type {ElementType} from 'react'
import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const {layout, tokens, key, refs, event} = useMarkput(s => ({
		layout: s.props.layout,
		tokens: s.state.tokens,
		key: s.key,
		refs: s.refs,
		event: s.event,
	}))

	// oxlint-disable-next-line no-unsafe-type-assertion -- containerComponent returns unknown in core; React ElementType asserted here
	const Component = useMarkput(s => s.computed.containerComponent) as ElementType
	const props = useMarkput(s => s.computed.containerProps)

	useLayoutEffect(() => {
		event.afterTokensRendered()
	}, [tokens, event])

	return (
		<Component ref={(el: HTMLDivElement | null) => (refs.container = el)} {...props}>
			{layout === 'block'
				? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</Component>
	)
})

Container.displayName = 'Container'