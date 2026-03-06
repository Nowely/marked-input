import {memo, useMemo} from 'react'

import {useStore} from '../lib/hooks/useStore'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {Token} from './Token'

export const Container = memo(() => {
	const store = useStore()
	const tokens = store.state.tokens.use()
	const slots = store.state.slots.use()
	const slotProps = store.state.slotProps.use()
	const className = store.state.className.use()
	const style = store.state.style.use()
	const key = store.key
	const refs = store.refs
	const ContainerComponent = useMemo(() => resolveSlot('container', slots), [slots])
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

Container.displayName = 'Container'