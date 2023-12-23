import {useState} from 'react'
import {assertAnnotated} from '../utils/checkers/assertAnnotated'
import {useStore} from '../utils/hooks/useStore'
import {useNode} from '../utils/providers/NodeProvider'

export function Piece() {
	const store = useStore()
	const [node] = useState(() => store.tokens[store.currentIndex])
	const {options, Mark} = useStore(store =>
		({options: store.props.options, Mark: store.props.Mark}), true)

	assertAnnotated(node)

	const defaultProps = {label: node.label, value: node.value}
	const props = options[node.optionIndex].initMark?.(defaultProps) ?? defaultProps

	//TODO correct typing
	// @ts-ignore
	return <Mark {...props}/>
}