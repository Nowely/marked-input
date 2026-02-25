import {NodeProxy} from '../../shared/classes/NodeProxy'
import type {Parser, Token} from '../parsing'
import type {CoreMarkputProps, OverlayMatch, Recovery} from '../../shared/types'
import {EventBus, SystemEvent, SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {CheckTriggerController, CloseOverlayController, TriggerController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

const IMMUTABLE_KEYS = new Set(['bus', 'refs', 'nodes', 'key', 'controllers'])

export class Store<TProps extends CoreMarkputProps = CoreMarkputProps> {
	// Utils domain
	readonly bus = new EventBus()
	readonly key = new KeyGenerator()

	// Controllers domain
	declare readonly controllers: {
		closeOverlay: CloseOverlayController
		trigger: TriggerController
		checkTrigger: CheckTriggerController
		focus: FocusController
		keydown: KeyDownController
		system: SystemListenerController
		textSelection: TextSelectionController
	}

	// Config domain
	props: TProps

	// Document domain
	tokens: Token[] = []
	parser?: Parser
	previousValue?: string

	// Navigation domain
	declare readonly nodes: {
		focus: NodeProxy
		input: NodeProxy
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

	static create = <TProps extends CoreMarkputProps>(props: TProps): Store<TProps> => {
		const rawStore = new Store<TProps>(props)

		const proxy = new Proxy(rawStore, {
			set: (target, prop, newValue, receiver) => {
				if (IMMUTABLE_KEYS.has(String(prop))) {
					return false
				}

				if (target[prop as keyof Store<TProps>] === newValue) {
					return true
				}

				;(target as any)[prop] = newValue
				target.bus.send(SystemEvent.STORE_UPDATED, receiver)
				return true
			},
		}) as Store<TProps>

		// Initialize nodes and controllers with the Proxy, not the raw store
		Object.defineProperty(proxy, 'nodes', {
			value: {
				focus: new NodeProxy(undefined, proxy),
				input: new NodeProxy(undefined, proxy),
			},
			writable: false,
			configurable: false,
		})

		Object.defineProperty(proxy, 'controllers', {
			value: {
				closeOverlay: new CloseOverlayController(proxy),
				trigger: new TriggerController(proxy),
				checkTrigger: new CheckTriggerController(proxy),
				focus: new FocusController(proxy),
				keydown: new KeyDownController(proxy),
				system: new SystemListenerController(proxy),
				textSelection: new TextSelectionController(proxy),
			},
			writable: false,
			configurable: false,
		})

		return proxy
	}
}
