import {
	defineState,
	defineEvents,
	BlockRegistry,
	KeyGenerator,
	NodeProxy,
	type UseHookFactory,
	type StateObject,
} from '../../shared/classes'
import type {CoreOption, CoreSlotProps, CoreSlots, MarkputHandler, MarkputState, OverlayMatch} from '../../shared/types'
import {resolveOptionSlot} from '../../shared/utils/resolveOptionSlot'
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
	defaultSpan: unknown
}

export interface Slot {
	use(...args: any[]): readonly unknown[]
}

export interface MarkSlot {
	use(token: Token): readonly unknown[]
}

export interface OverlaySlot {
	use(option?: CoreOption, defaultComponent?: unknown): readonly unknown[]
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
			options.createUseHook
		)
		this.slot = {
			container: {
				use: () =>
					[
						resolveSlot('container', this.state.slots.use() as CoreSlots | undefined),
						resolveSlotProps('container', this.state.slotProps.use() as CoreSlotProps | undefined),
					] as const,
			} as Slot,
			block: {
				use: () =>
					[
						resolveSlot('block', this.state.slots.use() as CoreSlots | undefined),
						resolveSlotProps('block', this.state.slotProps.use() as CoreSlotProps | undefined),
					] as const,
			} as Slot,
			span: {
				use: () =>
					[
						resolveSlot('span', this.state.slots.use() as CoreSlots | undefined),
						resolveSlotProps('span', this.state.slotProps.use() as CoreSlotProps | undefined),
					] as const,
			} as Slot,
			overlay: {
				use: (option?: CoreOption, defaultComponent?: unknown) => {
					const globalComponent = this.state.Overlay.use()
					const optionComponent = (option as any)?.Overlay
					const Component = optionComponent || globalComponent || defaultComponent
					if (!Component)
						throw new Error(
							'No overlay component found. Provide either option.Overlay, global Overlay, or a defaultComponent.'
						)
					const props = resolveOptionSlot<Record<string, unknown>>((option as any)?.overlay, {})
					return [Component, props] as const
				},
			},
			mark: {
				use: (token: Token) => {
					const tokenOptions = this.state.options.use() as unknown as CoreOption[] | undefined
					const GlobalMark = this.state.Mark.use()
					const GlobalSpan = this.state.Span.use()

					if (token.type === 'text') {
						return [GlobalSpan ?? this._defaultSpan, {value: token.content}] as const
					}

					const option = tokenOptions?.[token.descriptor.index]
					const baseProps = {value: token.value, meta: token.meta}
					const props = resolveOptionSlot((option as any)?.mark, baseProps)
					const Component = (option as any)?.Mark || GlobalMark
					if (!Component)
						throw new Error('No mark component found. Provide either option.Mark or global Mark.')
					return [Component, props] as const
				},
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