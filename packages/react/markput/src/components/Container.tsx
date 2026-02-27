import {memo} from 'react'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useListener} from '../lib/hooks/useListener'
import {useStore} from '../lib/hooks/useStore'
import {Token} from './Token'

export const Container = memo(() => {
	const {className, style, tokens, events, key, ContainerComponent, containerProps, refs} = useStore(
		s => ({
			className: s.props.className,
			style: s.props.style,
			tokens: s.state.tokens,
			events: s.events,
			key: s.key,
			refs: s.refs,
			ContainerComponent: resolveSlot('container', s),
			containerProps: resolveSlotProps('container', s),
		}),
		true
	)

	useListener('input', () => events.change.emit(), [])

	return (
		<ContainerComponent ref={refs.setContainer} {...containerProps} className={className} style={style}>
			{tokens.map(token => (
				<Token key={key.get(token)} mark={token} />
			))}
		</ContainerComponent>
	)
})

Container.displayName = 'Container'
