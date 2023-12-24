import {createRef} from 'react'
import {MarkedInputProps} from '../../components/MarkedInput'
import {SystemEvent} from '../../constants'
import {MarkStruct, OverlayMatch, Recovery} from '../../types'
import {EventBus} from './EventBus'
import {NodeProxy} from './NodeProxy'

export class Store {
	props: MarkedInputProps

	readonly focus = new NodeProxy(undefined, this)

	tokens: MarkStruct[] = []

	recovery?: Recovery

	readonly refs = {
		counter: 0,
		container: createRef<HTMLDivElement>(),
		overlay: createRef<HTMLElement>()
	}

	get currentIndex() {
		return this.refs.counter++ % this.tokens.length
	}

	previousValue?: string

	readonly bus = new EventBus()

	overlayMatch?: OverlayMatch

	static create(props: MarkedInputProps) {
		let store = new Store(props)
		store = new Proxy(store, {
			set(target: Store, prop: keyof Store, newValue: any, receiver: Store): boolean {
				if (prop === 'bus' || prop === 'refs' || prop === 'focus' || prop === 'currentIndex') return false

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