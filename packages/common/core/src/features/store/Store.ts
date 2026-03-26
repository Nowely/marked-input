import {
	defineState,
	defineEvents,
	BlockRegistry,
	KeyGenerator,
	NodeProxy,
	type UseHookFactory,
	type StateObject,
} from '../../shared/classes'
import type {MarkputHandler, MarkputState, OverlayMatch} from '../../shared/types'
import {resolveSlot, resolveSlotProps} from '../../shared/utils/resolveSlot'
import {DragController} from '../drag'
import {ContentEditableController} from '../editable'
import {SystemListenerController} from '../events'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {Lifecycle} from '../lifecycle'
import {OverlayController} from '../overlay'
import {parseWithParser} from '../parsing'
import type {Token} from '../parsing'
import {TextSelectionController} from '../selection'

export interface StoreOptions {
	createUseHook: UseHookFactory
}

export class Store {
	readonly key = new KeyGenerator()
	readonly blocks: BlockRegistry

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly state: StateObject<MarkputState>

	readonly slot: {
		container: {use(): readonly [unknown, Record<string, unknown> | undefined]}
		block: {use(): readonly [unknown, Record<string, unknown> | undefined]}
		span: {use(): readonly [unknown, Record<string, unknown> | undefined]}
	}

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
		drag: new DragController(this),
	}

	readonly lifecycle = new Lifecycle(this)

	constructor(options: StoreOptions) {
		this.blocks = new BlockRegistry(options.createUseHook)
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
				Span: undefined,
				Mark: undefined,
				Overlay: undefined,
				className: undefined,
				style: undefined,
				slots: undefined,
				slotProps: undefined,
				drag: false,
			},
			options.createUseHook
		)
		this.slot = {
			container: {
				use: () =>
					[
						resolveSlot('container', this.state.slots.use()),
						resolveSlotProps('container', this.state.slotProps.use()),
					] as const,
			},
			block: {
				use: () =>
					[
						resolveSlot('block', this.state.slots.use()),
						resolveSlotProps('block', this.state.slotProps.use()),
					] as const,
			},
			span: {
				use: () =>
					[
						resolveSlot('span', this.state.slots.use()),
						resolveSlotProps('span', this.state.slotProps.use()),
					] as const,
			},
		}
	}

	applyValue(newValue: string): void {
		const onChange = this.state.onChange.get()
		if (!onChange) return
		const newTokens = parseWithParser(this, newValue)
		this.state.tokens.set(newTokens)
		this.state.previousValue.set(newValue)
		onChange(newValue)
	}

	createHandler(): MarkputHandler {
		const {refs, nodes} = this
		return {
			get container() {
				return refs.container
			},
			get overlay() {
				return refs.overlay
			},
			focus() {
				nodes.focus.head?.focus()
			},
		}
	}
}