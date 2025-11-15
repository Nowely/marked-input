import {NodeProxy} from '../../shared/classes/NodeProxy'
import {Token} from '../parsing/ParserV2/types'
import {OverlayMatch, Recovery} from '../../shared/types'
import {EventBus, SystemEvent} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {CoreMarkputProps} from '../default/types'
import {Parser} from '../parsing/ParserV2/Parser'

export class Store<TProps extends CoreMarkputProps = CoreMarkputProps> {
	// Utils domain
	readonly bus = new EventBus()
	readonly key = new KeyGenerator()

	// Config domain
	props: TProps

	// Document domain
	tokens: Token[] = []
	parser?: Parser
	previousValue?: string

	// Navigation domain
	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}
	recovery?: Recovery

	// UI domain
	readonly refs = {
		container: null as HTMLDivElement | null,
		overlay: null as HTMLElement | null,
		setContainer: (element: HTMLDivElement | null) => {
			this.refs.container = element
		},
		setOverlay: (element: HTMLElement | null) => {
			this.refs.overlay = element
		},
	}
	selecting?: boolean

	// Overlay domain
	overlayMatch?: OverlayMatch

	private constructor(props: TProps) {
		this.props = props
	}

	static create = <TProps extends CoreMarkputProps>(props: TProps) => new Proxy(new Store<TProps>(props), {set})
}

function set<TProps extends CoreMarkputProps>(target: Store<TProps>, prop: keyof Store<TProps>, newValue: any, receiver: any): boolean {
	switch (prop) {
		case 'bus':
		case 'refs':
		case 'nodes':
		case 'key':
			return false
	}

	//TODO don't send event if not updated
	// @ts-expect-error TODO fix type
	target[prop] = newValue
	target.bus.send(SystemEvent.STORE_UPDATED, receiver)
	return true
}
