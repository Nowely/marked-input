import {NodeProxy} from '../../shared/classes/NodeProxy'
import type {Parser, Token} from '../parsing'
import type {CoreMarkputProps, OverlayMatch, Recovery} from '../../shared/types'
import {EventBus, SystemEvent, SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {CheckTriggerController, CloseOverlayController, TriggerController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

export class Store<TProps extends CoreMarkputProps = CoreMarkputProps> {
	// Utils domain
	readonly bus = new EventBus()
	readonly key = new KeyGenerator()

	// Controllers domain
	readonly controllers = {
		closeOverlay: new CloseOverlayController(this),
		trigger: new TriggerController(this),
		checkTrigger: new CheckTriggerController(this),
		focus: new FocusController(this),
		keydown: new KeyDownController(this),
		system: new SystemListenerController(this),
		textSelection: new TextSelectionController(this),
	}

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
	selecting?: 'drag' | 'all'

	// Overlay domain
	overlayMatch?: OverlayMatch

	private constructor(props: TProps) {
		this.props = props
	}

	static create = <TProps extends CoreMarkputProps>(props: TProps) => new Proxy(new Store<TProps>(props), {set})
}

const IMMUTABLE_KEYS = new Set(['bus', 'refs', 'nodes', 'key', 'controllers'])

function set<TProps extends CoreMarkputProps, K extends keyof Store<TProps>>(
	target: Store<TProps>,
	prop: K,
	newValue: Store<TProps>[K],
	receiver: Store<TProps>
): boolean {
	if (IMMUTABLE_KEYS.has(String(prop))) {
		return false
	}

	if (target[prop] === newValue) {
		return true
	}

	target[prop] = newValue
	target.bus.send(SystemEvent.STORE_UPDATED, receiver)
	return true
}
