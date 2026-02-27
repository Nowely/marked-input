import {NodeProxy} from '../../shared/classes/NodeProxy'
import {createReactiveProxy, Reactive} from '../../shared/classes/Reactive'
import type {Parser, Token} from '../parsing'
import type {CoreMarkputProps, OverlayMatch, Recovery} from '../../shared/types'
import {SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {CloseOverlayController, OverlayTriggerController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

export class Store<TProps extends CoreMarkputProps = CoreMarkputProps> {
	readonly key = new KeyGenerator()
	props: TProps

	readonly nodes: {
		focus: NodeProxy
		input: NodeProxy
	}
	readonly controllers: {
		closeOverlay: CloseOverlayController
		overlayTrigger: OverlayTriggerController
		focus: FocusController
		keydown: KeyDownController
		system: SystemListenerController
		textSelection: TextSelectionController
	}

	readonly events = {
		change: Reactive.event<void>(),
		parse: Reactive.event<void>(),
		delete: Reactive.event<{token: Token}>(),
		select: Reactive.event<{mark: Token; match: OverlayMatch}>(),
		clearTrigger: Reactive.event<void>(),
		checkTrigger: Reactive.event<void>(),
	}
	readonly #reactives = {
		tokens: new Reactive<Token[]>([]),
		parser: new Reactive<Parser | undefined>(undefined),
		previousValue: new Reactive<string | undefined>(undefined),
		recovery: new Reactive<Recovery | undefined>(undefined),
		selecting: new Reactive<'drag' | 'all' | undefined>(undefined),
		overlayMatch: new Reactive<OverlayMatch | undefined>(undefined),
	}
	readonly state = createReactiveProxy(this.#reactives)

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

	constructor(props: TProps) {
		this.props = props
		this.nodes = {
			focus: new NodeProxy(undefined, this),
			input: new NodeProxy(undefined, this),
		}
		this.controllers = {
			closeOverlay: new CloseOverlayController(this),
			overlayTrigger: new OverlayTriggerController(this),
			focus: new FocusController(this),
			keydown: new KeyDownController(this),
			system: new SystemListenerController(this),
			textSelection: new TextSelectionController(this),
		}
	}

	subscribe(callback: () => void): () => void {
		const unsubs = Object.values(this.#reactives).map(r => r.subscribe(() => callback()))
		return () => unsubs.forEach(u => u())
	}
}
