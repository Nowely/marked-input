import {defineState, defineEvents, type UseHookFactory, type StateObject} from '../../shared/classes'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {NodeProxy} from '../../shared/classes/NodeProxy'
import type {MarkputHandler, MarkputState, OverlayMatch} from '../../shared/types'
import {ContentEditableController} from '../editable'
import {SystemListenerController} from '../events'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {Lifecycle} from '../lifecycle'
import {OverlayController} from '../overlay'
import type {Token} from '../parsing'
import {TextSelectionController} from '../selection'

export interface StoreOptions {
	createUseHook: UseHookFactory
}

export class Store {
	readonly key = new KeyGenerator()

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly state: StateObject<MarkputState>

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
		contentEditable: new ContentEditableController(this),
	}

	readonly lifecycle = new Lifecycle(this)

	constructor(options: StoreOptions) {
		this.state = defineState<MarkputState>(
			{
				tokens: [],
				parser: undefined,
				previousValue: undefined,
				recovery: undefined,
				selecting: undefined,
				overlayMatch: undefined,
				value: undefined,
				defaultValue: undefined,
				onChange: undefined,
				readOnly: false,
				options: undefined,
				showOverlayOn: undefined,
				Mark: undefined,
				Overlay: undefined,
				className: undefined,
				style: undefined,
				slots: undefined,
				slotProps: undefined,
			},
			options.createUseHook
		)
	}

	createHandler(): MarkputHandler {
		const store = this
		return {
			get container() {
				return store.refs.container
			},
			get overlay() {
				return store.refs.overlay
			},
			focus() {
				store.nodes.focus.head?.focus()
			},
		}
	}
}