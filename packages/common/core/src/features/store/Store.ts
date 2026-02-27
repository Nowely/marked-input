import {NodeProxy} from '../../shared/classes/NodeProxy'
import {Reactive} from '../../shared/classes/Reactive'
import type {Parser, Token} from '../parsing'
import type {CoreMarkputProps, OverlayMatch, Recovery} from '../../shared/types'
import {SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {OverlayController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

export class Store<TProps extends CoreMarkputProps = CoreMarkputProps> {
	readonly key = new KeyGenerator()
	props!: TProps

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly controllers = {
		overlay: new OverlayController(this),
		focus: new FocusController(this),
		keydown: new KeyDownController(this),
		system: new SystemListenerController(this),
		textSelection: new TextSelectionController(this),
	}

	readonly state = {
		tokens: new Reactive<Token[]>([]),
		parser: new Reactive<Parser | undefined>(undefined),
		previousValue: new Reactive<string | undefined>(undefined),
		recovery: new Reactive<Recovery | undefined>(undefined),
		selecting: new Reactive<'drag' | 'all' | undefined>(undefined),
		overlayMatch: new Reactive<OverlayMatch | undefined>(undefined),
		$change: Reactive.event<void>(),
		$parse: Reactive.event<void>(),
		$delete: Reactive.event<{token: Token}>(),
		$select: Reactive.event<{mark: Token; match: OverlayMatch}>(),
		$clearOverlay: Reactive.event<void>(),
		$checkOverlay: Reactive.event<void>(),
	}

	readonly refs = {
		container: null as HTMLDivElement | null,
		overlay: null as HTMLElement | null,
	}

	constructor(props: TProps) {
		this.props = props
	}

	subscribe(callback: () => void): () => void {
		const unsubs = Object.values(this.state).map(r => r.subscribe(() => callback()))
		return () => unsubs.forEach(u => u())
	}
}
