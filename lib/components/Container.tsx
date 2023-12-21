import {memo} from 'react'
import {DefaultClass, SystemEvent} from '../constants'
import {isAnnotated} from '../utils/checkers/isAnnotated'
import {getKey} from '../utils/functions/getKey'
import {useListener} from '../utils/hooks/useListener'
import {useStore} from '../utils/hooks/useStore'
import {NodeProvider} from '../utils/providers/NodeProvider'
import {EditableSpan} from './EditableSpan'
import {Piece} from './Piece'

//TODO fix updating0
export const Container = memo(() => {
	const {className, style, pieces, refs, tokens, bus} = useStore(store => ({
		className: store.props.className ? DefaultClass + ' ' + store.props.className : DefaultClass,
		style: store.props.style,
		pieces: store.pieces,
		refs: store.refs,
		tokens: store.tokens,
		bus: store.bus,
	}), true)

	//TODO
	//const divOverride = useStore(getChildProps('div'), true)

	useListener('input', e => {
		bus.send(SystemEvent.Change, {node: e.target})
	}, [])

	//console.log(1)

	return (
		<div /*{...divOverride}*/ ref={refs.container} className={className} style={style}>
			{tokens.map((token) =>
				<NodeProvider key={getKey(token)} value={token}>
					{
						isAnnotated(token) ? <Piece/> : <EditableSpan/>
					}
				</NodeProvider>
			)}
		</div>
	)
})

Container.displayName = 'Container'