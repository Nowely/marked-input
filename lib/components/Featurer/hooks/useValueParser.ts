import {createRef, useEffect} from 'react'
import {isObject, useStore} from '../../../utils'
import LinkedList from '../../../utils/LinkedList'
import {Parser} from '../../../utils/Parser'
import {useSelector} from '../../../utils/useSelector'

//TODO Compare new input value with returned caching?
//TODO dont create a new object for returned value
//TODO move to marked text or store provider?
export const useValueParser = () => {
	const store = useStore()
	const {value, options} = useSelector(state => ({
		value: state.value,
		options: state.Mark ? state.options:undefined,
	}), true)

	useEffect(() => {
		if (store.changedNode) {
			const pieces = Parser.split(store.changedNode.data.mark.label, options)()
			if (pieces.length===1) return

			const data = pieces.map(piece => ({
				mark: isObject(piece) ? piece:{label: piece},
				ref: createRef<HTMLElement>()
			}))
			store.state.pieces
			data.forEach(value1 => {
				store.state.pieces.insertBefore(store.changedNode!, value1)
			})
			store.focusedNode = store.changedNode.next
			store.changedNode.remove()

			const newList = new LinkedList()
			store.state.pieces.forEach((data) => newList.append(data))

			store.changedNode = undefined
			store.setState({pieces: newList})
			return
		}

		const pieces = Parser.split(value, options)()
		const data = pieces.map(piece => ({
			mark: isObject(piece) ? piece:{label: piece},
			ref: createRef<HTMLElement>()
		}))
		store.setState({pieces: LinkedList.from(data)})

	}, [value, options])
}