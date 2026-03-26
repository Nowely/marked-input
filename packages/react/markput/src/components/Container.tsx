import {resolveSlot, resolveSlotProps} from '@markput/core'
import type {ElementType} from 'react'
import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {Block} from './Block'
import {Token} from './Token'

export const Container = memo(() => {
	const store = useStore()
	const drag = store.state.drag.use()
	const tokens = store.state.tokens.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const className = store.state.className.use()
	const style = store.state.style.use()
	const readOnly = store.state.readOnly.use()
	const key = store.key
	const refs = store.refs

	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	return (
		<ContainerComponent
			ref={(el: HTMLDivElement | null) => (refs.container = el)}
			{...containerProps}
			className={className}
			style={drag && !readOnly ? {paddingLeft: 24, ...style} : style}
		>
			{drag
				? tokens.map((t, i) => <Block key={key.get(t)} token={t} blockIndex={i} />)
				: tokens.map(t => <Token key={key.get(t)} mark={t} />)}
		</ContainerComponent>
	)
})

Container.displayName = 'Container'