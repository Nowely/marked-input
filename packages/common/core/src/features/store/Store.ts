import {NodeProxy} from '../../shared/classes/NodeProxy'
import {Signal} from '../../shared/classes/Signal'
import type {Parser, Token} from '../parsing'
import type {CoreMarkputProps, OverlayMatch, Recovery} from '../../shared/types'
import {EventBus, SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {CheckTriggerController, CloseOverlayController, TriggerController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

type ReactiveKeys = 'tokens' | 'parser' | 'previousValue' | 'recovery' | 'selecting' | 'overlayMatch'

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

	// Reactive signals (internal)
	readonly #signals: {
		tokens: Signal<Token[]>
		parser: Signal<Parser | undefined>
		previousValue: Signal<string | undefined>
		recovery: Signal<Recovery | undefined>
		selecting: Signal<'drag' | 'all' | undefined>
		overlayMatch: Signal<OverlayMatch | undefined>
	}

	constructor(props: TProps) {
		this.props = props

		// Initialize signals
		this.#signals = {
			tokens: new Signal<Token[]>([]),
			parser: new Signal<Parser | undefined>(undefined),
			previousValue: new Signal<string | undefined>(undefined),
			recovery: new Signal<Recovery | undefined>(undefined),
			selecting: new Signal<'drag' | 'all' | undefined>(undefined),
			overlayMatch: new Signal<OverlayMatch | undefined>(undefined),
		}

		// Initialize nodes
		Object.defineProperty(this, 'nodes', {
			value: {
				focus: new NodeProxy(undefined, this),
				input: new NodeProxy(undefined, this),
			},
			writable: false,
			configurable: false,
		})

		// Initialize controllers
		Object.defineProperty(this, 'controllers', {
			value: {
				closeOverlay: new CloseOverlayController(this),
				trigger: new TriggerController(this),
				checkTrigger: new CheckTriggerController(this),
				focus: new FocusController(this),
				keydown: new KeyDownController(this),
				system: new SystemListenerController(this),
				textSelection: new TextSelectionController(this),
			},
			writable: false,
			configurable: false,
		})
	}

	// Document domain - simple getters/setters
	get tokens(): Token[] {
		return this.#signals.tokens.get()
	}

	set tokens(value: Token[]) {
		this.#signals.tokens.set(value)
	}

	get parser(): Parser | undefined {
		return this.#signals.parser.get()
	}

	set parser(value: Parser | undefined) {
		this.#signals.parser.set(value)
	}

	get previousValue(): string | undefined {
		return this.#signals.previousValue.get()
	}

	// Navigation domain
	declare readonly nodes: {
		focus: NodeProxy
		input: NodeProxy
	}

	set previousValue(value: string | undefined) {
		this.#signals.previousValue.set(value)
	}

	get recovery(): Recovery | undefined {
		return this.#signals.recovery.get()
	}

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

	set recovery(value: Recovery | undefined) {
		this.#signals.recovery.set(value)
	}

	get selecting(): 'drag' | 'all' | undefined {
		return this.#signals.selecting.get()
	}

	set selecting(value: 'drag' | 'all' | undefined) {
		this.#signals.selecting.set(value)
	}

	// Overlay domain
	get overlayMatch(): OverlayMatch | undefined {
		return this.#signals.overlayMatch.get()
	}

	set overlayMatch(value: OverlayMatch | undefined) {
		this.#signals.overlayMatch.set(value)
	}

	// Deprecated: Use new Store() instead
	static create = <TProps extends CoreMarkputProps>(props: TProps): Store<TProps> => {
		console.warn('Store.create() is deprecated. Use new Store() instead.')
		return new Store<TProps>(props)
	}

	// Subscribe to a specific reactive property
	on<K extends ReactiveKeys>(key: K, callback: (value: any) => void): () => void {
		const signal = this.#signals[key]
		return signal.subscribe(callback)
	}

	// Subscribe to all reactive property changes
	subscribe(callback: () => void): () => void {
		const unsubscribers: (() => void)[] = []
		for (const key of Object.keys(this.#signals) as ReactiveKeys[]) {
			unsubscribers.push(this.#signals[key].subscribe(() => callback()))
		}
		return () => unsubscribers.forEach(unsub => unsub())
	}
}
