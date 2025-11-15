import {memo} from 'react'
import {resolveSlot, resolveSlotProps, mergeClassNames, mergeStyles} from '../utils/functions/resolveSlot'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'
import {Token} from './Token'
import {SystemEvent} from '@markput/core'

export const Container = memo(() => {
	const {className, style, refs, tokens, bus, key, ContainerComponent, containerProps} = useStore(
		store => ({
			className: store.props.className,
			style: store.props.style,
			refs: store.refs,
			tokens: store.tokens,
			bus: store.bus,
			key: store.key,
			ContainerComponent: resolveSlot('container', store),
			containerProps: resolveSlotProps('container', store),
		}),
		true
	)

	useListener(
		'input',
		() => {
			bus.send(SystemEvent.Change)
		},
		[]
	)

	return (
		<ContainerComponent
			ref={refs.container}
			{...containerProps}
			className={mergeClassNames(className, containerProps?.className)}
			style={mergeStyles(style, containerProps?.style)}
		>
			{tokens.map(token => (
				<Token key={key.get(token)} mark={token} />
			))}
		</ContainerComponent>
	)
})

Container.displayName = 'Container'
