import {NodeProxy} from '../../shared/classes/NodeProxy'
import {defineState, defineEvents, type UseHookFactory} from '../../shared/classes'
import type {Parser, Token} from '../parsing'
import type {CoreMarkputProps, OverlayMatch, Recovery} from '../../shared/types'
import {SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {OverlayController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

export interface StoreOptions {
	createUseHook: UseHookFactory
}

export class Store<TProps extends CoreMarkputProps = CoreMarkputProps> {
	readonly key = new KeyGenerator()

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly state: ReturnType<
		typeof defineState<{
			tokens: Token[]
			parser: Parser | undefined
			previousValue: string | undefined
			recovery: Recovery | undefined
			selecting: 'drag' | 'all' | undefined
			overlayMatch: OverlayMatch | undefined
		}>
	>

	readonly events = defineEvents<{
		change: void
		parse: void
		delete: {token: Token}
		select: {mark: Token; match: OverlayMatch}
		clearOverlay: void
		checkOverlay: void
	}>()

	readonly refs = {
		container: null as HTMLDivElement | null,
		overlay: null as HTMLElement | null,
	}

	readonly controllers = {
		overlay: new OverlayController(this),
		focus: new FocusController(this),
		keydown: new KeyDownController(this),
		system: new SystemListenerController(this),
		textSelection: new TextSelectionController(this),
	}

	constructor(
		public props: TProps,
		options: StoreOptions
	) {
		this.state = defineState(
			{
				tokens: [] as Token[],
				parser: undefined as Parser | undefined,
				previousValue: undefined as string | undefined,
				recovery: undefined as Recovery | undefined,
				selecting: undefined as 'drag' | 'all' | undefined,
				overlayMatch: undefined as OverlayMatch | undefined,
			},
			options.createUseHook
		)
	}
}
