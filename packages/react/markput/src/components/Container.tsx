import {resolveSlot, resolveSlotProps} from '@markput/core'
import type {ElementType} from 'react'
import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {DragContainer} from './DragContainer'
import {Token} from './Token'

const FlatContainer = memo(() => {
	const store = useStore()
	const tokens = store.state.tokens.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const className = store.state.className.use()
	const style = store.state.style.use()
	const key = store.key
	const refs = store.refs
	const ContainerComponent = useMemo(() => resolveSlot<ElementType>('container', slots), [slots])
	const containerProps = useMemo(() => resolveSlotProps('container', slotProps), [slotProps])

	return (
		<ContainerComponent
			ref={(el: HTMLDivElement | null) => (refs.container = el)}
			{...containerProps}
			className={className}
			style={style}
		>
			{tokens.map(token => (
				<Token key={key.get(token)} mark={token} />
			))}
		</ContainerComponent>
	)
})

FlatContainer.displayName = 'FlatContainer'

export const Container = memo(() => {
	const store = useStore()
	const drag = store.state.drag.use()
	return drag ? <DragContainer /> : <FlatContainer />
})

Container.displayName = 'Container'