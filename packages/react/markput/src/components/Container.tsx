import {memo, useLayoutEffect} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const store = useStore()
	const drag = store.state.drag.use()
	const tokens = store.state.tokens.use()

	useLayoutEffect(() => {
		store.event.afterTokensRendered()
	}, [tokens])

	const className = store.computed.containerClass.use()
	const style = store.computed.containerStyle.use()
	const readOnly = store.state.readOnly.use()
	const key = store.key
	const refs = store.refs

	const [ContainerComponent, containerProps] = store.computed.container.use()

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