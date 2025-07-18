import {memo} from 'react'
import {SystemEvent} from '../constants'
import {getChildProps} from '../utils/functions/getChildProps'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'
import {Token} from './Token'

export const Container = memo(() => {
	const {className, style, refs, tokens, bus, key} = useStore(
		store => ({
			className: store.props.className,
			style: store.props.style,
			refs: store.refs,
			tokens: store.tokens,
			bus: store.bus,
			key: store.key,
		}),
		true
	)

	const divOverride = useStore(getChildProps('div'), true)

	useListener(
		'input',
		e => {
			bus.send(SystemEvent.Change)
		},
		[]
	)

	return (
		<div {...divOverride} ref={refs.container} className={className} style={style}>
			{tokens.map(token => (
				<Token key={key.get(token)} mark={token} />
			))}
		</div>
	)
})

Container.displayName = 'Container'
