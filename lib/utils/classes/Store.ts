import {createRef} from 'react'
import {SystemEvent} from '../../constants'
import {InnerMarkedInputProps} from '../../features/default'
import {MarkStruct, OverlayMatch, Recovery} from '../../types'
import {EventBus} from './EventBus'
import {KeyGenerator} from './KeyGenerator'
import {NodeProxy} from './NodeProxy'

export class Store {
	readonly bus = new EventBus()
	readonly key = new KeyGenerator()
	readonly focus = new NodeProxy(undefined, this)
	//TODO rename to input node?
	readonly input = new NodeProxy(undefined, this)

	props: InnerMarkedInputProps
	tokens: MarkStruct[] = []
	recovery?: Recovery

	readonly refs = {
		container: createRef<HTMLDivElement>(),
		overlay: createRef<HTMLElement>(),
	}

	selecting?: boolean

	previousValue?: string
	overlayMatch?: OverlayMatch

	private constructor(props: InnerMarkedInputProps) {
		this.props = props
	}

	static create = (props: InnerMarkedInputProps) => new Proxy(new Store(props), {set})
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

	//TODO don't send event if not updated
	// @ts-expect-error TODO fix type
	target[prop] = newValue
	target.bus.send(SystemEvent.STORE_UPDATED, receiver)
	return true
}
