import {createRef} from 'react'
import {SystemEvent} from '../../constants'
import {DefaultedProps, MarkStruct, OverlayMatch, Recovery} from '../../types'
import {EventBus} from './EventBus'
import {KeyGenerator} from './KeyGenerator'
import {NodeProxy} from './NodeProxy'

export class Store {
	readonly bus = new EventBus()
	readonly key = new KeyGenerator()
	readonly focus = new NodeProxy(undefined, this)
	//TODO rename to input node?
	readonly input = new NodeProxy(undefined, this)

	props: DefaultedProps
	tokens: MarkStruct[] = []
	recovery?: Recovery

	readonly refs = {
		container: createRef<HTMLDivElement>(),
		overlay: createRef<HTMLElement>()
	}

	selecting?: boolean

	previousValue?: string
	overlayMatch?: OverlayMatch

	static create = (props: DefaultedProps) => new Proxy(new Store(props), {set})

	private constructor(props: DefaultedProps) {
		this.props = props
	}
}

function set(target: Store, prop: keyof Store, newValue: any, receiver: any): boolean {
	switch (prop) {
		case 'bus':
		case 'refs':
		case 'focus':
		case 'input':
		case 'key':
			return false
	}

	target[prop] = newValue
	target.bus.send(SystemEvent.STORE_UPDATED, receiver)
	return true
}