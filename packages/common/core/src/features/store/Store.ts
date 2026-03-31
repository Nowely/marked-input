import {
	defineState,
	defineEvents,
	BlockRegistry,
	KeyGenerator,
	NodeProxy,
	type UseHookFactory,
	type StateObject,
} from '../../shared/classes'
import type {CoreOption, MarkputHandler, MarkputState, OverlayMatch} from '../../shared/types'
import {
	resolveMarkSlot,
	resolveOverlaySlot,
	resolveSlot,
	resolveSlotProps,
	type SlotOption,
} from '../../shared/utils/resolveSlot'
import {shallow} from '../../shared/utils/shallow'
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
	defaultSpan: unknown
}

export interface Slot {
	use(...args: unknown[]): readonly unknown[]
	get(...args: unknown[]): readonly unknown[]
}

export interface MarkSlot {
	use(token: Token): readonly unknown[]
	get(token: Token): readonly unknown[]
}

export interface OverlaySlot {
	use(option?: CoreOption, defaultComponent?: unknown): readonly unknown[]
	get(option?: CoreOption, defaultComponent?: unknown): readonly unknown[]
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
		container: Slot
		block: Slot
		span: Slot
		overlay: OverlaySlot
		mark: MarkSlot
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

	private readonly _defaultSpan: unknown

	constructor(options: StoreOptions) {
		this._defaultSpan = options.defaultSpan
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
			options.createUseHook,
			{equals: {style: shallow}}
		)
		this.slot = {
			container: {
				use: () =>
					[
						resolveSlot('container', this.state.slots.use()),
						resolveSlotProps('container', this.state.slotProps.use()),
					] as const,
				get: () =>
					[
						resolveSlot('container', this.state.slots.get()),
						resolveSlotProps('container', this.state.slotProps.get()),
					] as const,
			} as Slot,
			block: {
				use: () =>
					[
						resolveSlot('block', this.state.slots.use()),
						resolveSlotProps('block', this.state.slotProps.use()),
					] as const,
				get: () =>
					[
						resolveSlot('block', this.state.slots.get()),
						resolveSlotProps('block', this.state.slotProps.get()),
					] as const,
			} as Slot,
			span: {
				use: () =>
					[
						resolveSlot('span', this.state.slots.use()),
						resolveSlotProps('span', this.state.slotProps.use()),
					] as const,
				get: () =>
					[
						resolveSlot('span', this.state.slots.get()),
						resolveSlotProps('span', this.state.slotProps.get()),
					] as const,
			} as Slot,
			overlay: {
				use: (option?: CoreOption, defaultComponent?: unknown) =>
					resolveOverlaySlot(this.state.Overlay.use(), option, defaultComponent),
				get: (option?: CoreOption, defaultComponent?: unknown) =>
					resolveOverlaySlot(this.state.Overlay.get(), option, defaultComponent),
			} as unknown as OverlaySlot,
			mark: {
				use: (token: Token) =>
					resolveMarkSlot(
						token,
						this.state.options.get() as unknown as SlotOption[] | undefined,
						this.state.Mark.use(),
						this.state.Span.use(),
						this._defaultSpan
					),
				get: (token: Token) =>
					resolveMarkSlot(
						token,
						this.state.options.get() as unknown as SlotOption[] | undefined,
						this.state.Mark.get(),
						this.state.Span.get(),
						this._defaultSpan
					),
			} as unknown as MarkSlot,
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