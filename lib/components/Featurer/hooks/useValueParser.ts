import {createRef, useEffect, useMemo, useRef} from 'react'
import {NodeData, Piece} from '../../../types'
import {genKey, isObject, useStore} from '../../../utils'
import LinkedList from '../../../utils/LinkedList'
import LinkedListNode from '../../../utils/LinkedListNode'
import {Parser} from '../../../utils/Parser'
import {useSelector} from '../../../utils/useSelector'

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
//TODO move to marked text?
export const useValueParser = () => {
	const store = useStore()
	const {value, options} = useSelector(state => ({value: state.value, options: state.options}), true)

	const pieces = useMemo(Parser.split(value, options), [value, options])
	const previous = useRef<LinkedList<NodeData> | null>(null)

	useEffect(() => {
		const existedKeys = new Set<number>()
		//get data from previous if exists
		const data = pieces.map(piece => {
			let key = genKey(piece, existedKeys)
			const node = previous.current?.findNode(data => data.key === key)

			if (!node || hasOutdatedState(piece, node) && key++)
				return {
					key,
					mark: isObject(piece) ? piece : {label: piece},
					ref: createRef<HTMLElement>()
				}

			return node.data
		})

		previous.current = LinkedList.from(data)
		store.setState({pieces: previous.current})
	}, [pieces.length])
}

const hasOutdatedState = (piece: Piece, node: LinkedListNode<NodeData>) => {
	if (isObject(piece)) return false
	return node.data.mark.label !== piece
}