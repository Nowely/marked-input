import {resolveSlot, resolveSlotProps, EMPTY_TEXT_TOKEN} from '@markput/core'
import type {ElementType} from 'react'
import {memo, useMemo} from 'react'

import {useStore} from '../lib/providers/StoreContext'
import {Container} from './Container'

export const DragContainer = memo(() => {
	const store = useStore()
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

	const rows = useMemo(() => {
		return tokens.length > 0 ? tokens : [EMPTY_TEXT_TOKEN]
	}, [tokens])

	return (
		<ContainerComponent
			ref={(el: HTMLDivElement | null) => (refs.container = el)}
			{...containerProps}
			className={className}
			style={readOnly ? style : {paddingLeft: 24, ...style}}
		>
			{rows.map((token, index) => (
				<Container key={key.get(token)} tokens={[token]} blockIndex={index} />
			))}
		</ContainerComponent>
	)
})

DragContainer.displayName = 'DragContainer'