import {BlockRegistry, KeyGenerator, NodeProxy} from '../../shared/classes'
import {DEFAULT_OPTIONS} from '../../shared/constants'
import {signal, event, batch} from '../../shared/signals'
import type {SignalValues} from '../../shared/signals'
import type {
	CoreOption,
	MarkputHandler,
	OverlayMatch,
	OverlayTrigger,
	Recovery,
	GenericComponent,
	StyleProperties,
	CoreSlots,
	CoreSlotProps,
} from '../../shared/types'
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from '../../shared/utils/resolveSlot'
import {shallow} from '../../shared/utils/shallow'
import {CopyController} from '../clipboard'
import {DragController} from '../drag'
import {ContentEditableController} from '../editable'
import {SystemListenerController} from '../events'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {Lifecycle} from '../lifecycle'
import {OverlayController} from '../overlay'
import {parseWithParser} from '../parsing'
import type {Parser, Token} from '../parsing'
import {TextSelectionController} from '../selection'

export interface StoreOptions {
	defaultSpan: unknown
}

export interface Slot {
	use(): readonly unknown[]
	get(): readonly unknown[]
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
	readonly blocks = new BlockRegistry()

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly state = {
		// Data
		tokens: signal<Token[]>([]),
		parser: signal<Parser | undefined>(undefined),
		value: signal<string | undefined>(undefined),
		defaultValue: signal<string | undefined>(undefined),
		previousValue: signal<string | undefined>(undefined),
		recovery: signal<Recovery | undefined>(undefined),

		// Selection
		selecting: signal<'drag' | 'all' | undefined>(undefined),
		drag: signal<boolean | {alwaysShowHandle: boolean}>(false),

		// Overlay
		overlayMatch: signal<OverlayMatch | undefined>(undefined),
		showOverlayOn: signal<OverlayTrigger>('change'),

		// Callbacks
		onChange: signal<((value: string) => void) | undefined>(undefined),

		// Config
		options: signal<CoreOption[]>(DEFAULT_OPTIONS),
		readOnly: signal<boolean>(false),

		// Component overrides
		Span: signal<GenericComponent | undefined>(undefined),
		Mark: signal<GenericComponent | undefined>(undefined),
		Overlay: signal<GenericComponent | undefined>(undefined),

		// Styling
		className: signal<string | undefined>(undefined),
		style: signal<StyleProperties | undefined>(undefined, {equals: shallow}),

		// Slot system
		slots: signal<CoreSlots | undefined>(undefined),
		slotProps: signal<CoreSlotProps | undefined>(undefined),
	}

	readonly slot: {
		container: Slot
		block: Slot
		span: Slot
		overlay: OverlaySlot
		mark: MarkSlot
	}

	readonly events = {
		change: event(),
		parse: event(),
		delete: event<{token: Token}>(),
		select: event<{mark: Token; match: OverlayMatch}>(),
		clearOverlay: event(),
		checkOverlay: event(),
	}

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
		copy: new CopyController(this),
	}

	readonly lifecycle = new Lifecycle(this)

	private readonly _defaultSpan: unknown

	constructor(options: StoreOptions) {
		this._defaultSpan = options.defaultSpan
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
			// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment OverlaySlot with typed overloads; core satisfies the base interface
			overlay: {
				use: (option?: CoreOption, defaultComponent?: unknown) =>
					resolveOverlaySlot(this.state.Overlay.use(), option, defaultComponent),
				get: (option?: CoreOption, defaultComponent?: unknown) =>
					resolveOverlaySlot(this.state.Overlay.get(), option, defaultComponent),
			} as unknown as OverlaySlot,
			// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment MarkSlot with typed overloads; core satisfies the base interface
			mark: {
				use: (token: Token) =>
					resolveMarkSlot(
						token,
						this.state.options.get(),
						this.state.Mark.use(),
						this.state.Span.use(),
						this._defaultSpan
					),
				get: (token: Token) =>
					resolveMarkSlot(
						token,
						this.state.options.get(),
						this.state.Mark.get(),
						this.state.Span.get(),
						this._defaultSpan
					),
			} as unknown as MarkSlot,
		}
	}

	applyValue(newValue: string): void {
		const onChange = this.state.onChange.get()
		const newTokens = parseWithParser(this, newValue)
		this.state.tokens.set(newTokens)
		this.state.previousValue.set(newValue)
		onChange?.(newValue)
	}

	setState(values: Partial<SignalValues<typeof this.state>>): void {
		batch(() => {
			for (const k in values) {
				// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous map: per-key signal types verified by SignalValues<T> at the call site
				this.state[k as keyof typeof this.state].set(values[k as keyof typeof values] as never)
			}
		})
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