import type {ElementType} from 'react'
import {memo, useLayoutEffect} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const store = useStore()

	const {drag, tokens, className, style, readOnly} = useMarkput(s => ({
		drag: s.props.drag,
		tokens: s.state.tokens,
		className: s.computed.containerClass,
		style: s.computed.containerStyle,
		readOnly: s.props.readOnly,
	}))

	// oxlint-disable-next-line no-unsafe-type-assertion -- Slot returns [unknown, ...] in core; React-specific type asserted here
	const [ContainerComponent, containerProps] = useMarkput(s => s.computed.container) as readonly [
		ElementType,
		Record<string, unknown> | undefined,
	]

	useLayoutEffect(() => {
		store.event.afterTokensRendered()
	}, [tokens])

	const key = store.key
	const refs = store.refs

	const containerStyle = drag && !readOnly ? (style ? {paddingLeft: 24, ...style} : {paddingLeft: 24}) : style

	return (
		<ContainerComponent
			ref={(el: HTMLDivElement | null) => (refs.container = el)}
			{...containerProps}
			className={className}
			style={containerStyle}
		>
			{drag
				? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</ContainerComponent>
	)
})

Container.displayName = 'Container'