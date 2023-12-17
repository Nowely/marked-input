import {createRef} from 'react'
import {MarkedInputProps} from '../../components/MarkedInput'
import {EmptyList, SystemEvent} from '../../constants'
import {NodeData, OverlayMatch, Recovery} from '../../types'
import {EventBus} from './EventBus'
import LinkedListNode from './LinkedList/LinkedListNode'

export class Store {
	props: MarkedInputProps

	changedNode?: LinkedListNode<NodeData>
	focusedNode?: LinkedListNode<NodeData>

	recovery?: Recovery

	readonly refs = {
		container: createRef<HTMLDivElement>(),
		overlay: createRef<HTMLElement>()
	}

	previousValue?: string

	readonly bus = new EventBus()

	overlayMatch?: OverlayMatch

	pieces = EmptyList

	static create(props: MarkedInputProps) {
		let store = new Store(props)
		store = new Proxy(store, {
			set(target: Store, prop: keyof Store, newValue: any, receiver: Store): boolean {
				if (prop === 'bus' || prop === 'refs') return false

				target[prop] = newValue
				target.bus.send(SystemEvent.STORE_UPDATED, store)
				return true
			}
		})
		return store
	}

	private constructor(props: MarkedInputProps) {
		this.props = props
	}
}