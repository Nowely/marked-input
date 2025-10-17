import {NodeProxy} from '../../shared/classes'
import {MarkStruct} from '../parsing/ParserV1/types'
import {OverlayMatch, Recovery} from '../../shared/types'
import {EventBus, SystemEvent} from '../events'
import {KeyGenerator} from '../../shared/classes'
import {InnerMarkedInputProps} from '../default/types'

interface Ref<T> {
	/**
	 * The current value of the ref.
	 */
	readonly current: T | null
}

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
		container: {
			current: null,
		} as Ref<HTMLDivElement>,
		overlay: {
			current: null,
		} as Ref<HTMLElement>,
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
