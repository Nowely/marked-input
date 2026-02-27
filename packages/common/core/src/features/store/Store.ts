import {NodeProxy} from '../../shared/classes/NodeProxy'
import {Reactive} from '../../shared/classes/Reactive'
import type {Parser, Token} from '../parsing'
import type {CoreMarkputProps, OverlayMatch, Recovery} from '../../shared/types'
import {SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {CheckTriggerController, CloseOverlayController, TriggerController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

export class Store<TProps extends CoreMarkputProps = CoreMarkputProps> {
	readonly key = new KeyGenerator()

	declare readonly controllers: {
		closeOverlay: CloseOverlayController
		trigger: TriggerController
		checkTrigger: CheckTriggerController
		focus: FocusController
		keydown: KeyDownController
		system: SystemListenerController
		textSelection: TextSelectionController
	}

	props: TProps

	readonly events = {
		change: Reactive.event<void>(),
		parse: Reactive.event<void>(),
		delete: Reactive.event<{token: Token}>(),
		select: Reactive.event<{mark: Token; match: OverlayMatch}>(),
		clearTrigger: Reactive.event<void>(),
		checkTrigger: Reactive.event<void>(),
	}
	readonly #state = {
		tokens: new Reactive<Token[]>([]),
		parser: new Reactive<Parser | undefined>(undefined),
		previousValue: new Reactive<string | undefined>(undefined),
		recovery: new Reactive<Recovery | undefined>(undefined),
		selecting: new Reactive<'drag' | 'all' | undefined>(undefined),
		overlayMatch: new Reactive<OverlayMatch | undefined>(undefined),
	}

	constructor(props: TProps) {
		this.props = props

		Object.defineProperty(this, 'nodes', {
			value: {
				focus: new NodeProxy(undefined, this),
				input: new NodeProxy(undefined, this),
			},
			writable: false,
			configurable: false,
		})

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

	get tokens(): Token[] {
		return this.#state.tokens.get()
	}

	set tokens(value: Token[]) {
		this.#state.tokens.set(value)
	}

	get parser(): Parser | undefined {
		return this.#state.parser.get()
	}

	set parser(value: Parser | undefined) {
		this.#state.parser.set(value)
	}

	get previousValue(): string | undefined {
		return this.#state.previousValue.get()
	}

	set previousValue(value: string | undefined) {
		this.#state.previousValue.set(value)
	}

	get recovery(): Recovery | undefined {
		return this.#state.recovery.get()
	}

	set recovery(value: Recovery | undefined) {
		this.#state.recovery.set(value)
	}

	get selecting(): 'drag' | 'all' | undefined {
		return this.#state.selecting.get()
	}

	set selecting(value: 'drag' | 'all' | undefined) {
		this.#state.selecting.set(value)
	}

	get overlayMatch(): OverlayMatch | undefined {
		return this.#state.overlayMatch.get()
	}

	set overlayMatch(value: OverlayMatch | undefined) {
		this.#state.overlayMatch.set(value)
	}

	declare readonly nodes: {
		focus: NodeProxy
		input: NodeProxy
	}

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

	static create = <TProps extends CoreMarkputProps>(props: TProps): Store<TProps> => {
		console.warn('Store.create() is deprecated. Use new Store() instead.')
		return new Store<TProps>(props)
	}

	subscribe(callback: () => void): () => void {
		const unsubs = Object.values(this.#state).map(r => r.subscribe(() => callback()))
		return () => unsubs.forEach(u => u())
	}
}
