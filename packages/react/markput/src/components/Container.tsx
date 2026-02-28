import {memo, useMemo} from 'react'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useListener} from '../lib/hooks/useListener'
import {useStore} from '../lib/hooks/useStore'
import {useReactive} from '../lib/hooks/useReactive'
import {Token} from './Token'

export const Container = memo(() => {
	const store = useStore()
	const tokens = useReactive(store.state.tokens)

	const className = store.props.className
	const style = store.props.style
	const key = store.key
	const refs = store.refs
	const ContainerComponent = useMemo(() => resolveSlot('container', store), [store])
	const containerProps = useMemo(() => resolveSlotProps('container', store), [store])

	useListener('input', () => store.events.change(), [])

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
