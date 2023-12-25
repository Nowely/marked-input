import {memo} from 'react'
import {DefaultClass, SystemEvent} from '../constants'
import {getKey} from '../utils/functions/getKey'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'
import {Token} from './Token'

//TODO fix updating0
export const Container = memo(() => {
	const {className, style, refs, tokens, bus} = useStore(store => ({
		className: store.props.className ? DefaultClass + ' ' + store.props.className : DefaultClass,
		style: store.props.style,
		refs: store.refs,
		tokens: store.tokens,
		bus: store.bus,
	}), true)

	//TODO
	//const divOverride = useStore(getChildProps('div'), true)

	useListener('input', e => {
		bus.send(SystemEvent.Change, {node: e.target})
	}, [])

	return (
		<div /*{...divOverride}*/ ref={refs.container} className={className} style={style}>
			{tokens.map(token => <Token key={getKey(token)} mark={token}/>)}
		</div>
	)
})

Container.displayName = 'Container'