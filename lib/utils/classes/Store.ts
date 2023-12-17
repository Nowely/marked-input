import {createRef} from 'react'
import {MarkedInputProps} from '../../components/MarkedInput'
import {EmptyList, EVENT} from '../../constants'
import {NodeData, Recovery, State} from '../../types'
import {EventBus} from './EventBus'
import LinkedListNode from './LinkedList/LinkedListNode'

export class Store {
	#state: MarkedInputProps & State

	changedNode?: LinkedListNode<NodeData>
	focusedNode?: LinkedListNode<NodeData>

	recovery?: Recovery

	containerRef = createRef<HTMLDivElement>()
	overlayRef = createRef<HTMLElement>()

	previousValue?: string

	readonly bus = new EventBus()

	get state(): MarkedInputProps & State {
		return this.#state
	}

	constructor(props: MarkedInputProps) {
		this.#state = {...props, pieces: EmptyList}
	}

	setState(state: Partial<MarkedInputProps & State>) {
		this.#state = {...this.#state, ...state}
		this.bus.send(EVENT.State, this.#state)
	}
}