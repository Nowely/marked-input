import {memo} from 'react'
import {resolveSlot, resolveSlotProps} from '../lib/utils/resolveSlot'
import {useListener} from '../lib/hooks/useListener'
import {useStore} from '../lib/hooks/useStore'
import {Token} from './Token'
import {SystemEvent} from '@markput/core'

export const Container = memo(() => {
	const {className, style, tokens, bus, key, ContainerComponent, containerProps, refs} = useStore(
		s => ({
			className: s.props.className,
			style: s.props.style,
			tokens: s.tokens,
			bus: s.bus,
			key: s.key,
			refs: s.refs,
			ContainerComponent: resolveSlot('container', s),
			containerProps: resolveSlotProps('container', s),
		}),
		true
	)

	useListener('input', () => bus.send(SystemEvent.Change), [])

	return (
		<ContainerComponent ref={refs.setContainer} {...containerProps} className={className} style={style}>
			{tokens.map(token => (
				<Token key={key.get(token)} mark={token} />
			))}
		</ContainerComponent>
	)
})

Container.displayName = 'Container'
