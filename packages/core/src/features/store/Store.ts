import {BlockRegistry, KeyGenerator, MarkputHandler, NodeProxy} from '../../shared/classes'
import {DEFAULT_OPTIONS} from '../../shared/constants'
import {signal, computed, event, batch} from '../../shared/signals'
import type {Signal, Computed, SignalValues} from '../../shared/signals'
import type {
	CoreOption,
	OverlayMatch,
	OverlayTrigger,
	Recovery,
	GenericComponent,
	StyleProperties,
	CoreSlots,
	CoreSlotProps,
} from '../../shared/types'

type StoreState = {
	tokens: Signal<Token[]>
	parser: Signal<Parser | undefined>
	value: Signal<string | undefined>
	defaultValue: Signal<string | undefined>
	previousValue: Signal<string | undefined>
	recovery: Signal<Recovery | undefined>
	selecting: Signal<'drag' | 'all' | undefined>
	drag: Signal<boolean | {alwaysShowHandle: boolean}>
	overlayMatch: Signal<OverlayMatch | undefined>
	showOverlayOn: Signal<OverlayTrigger>
	onChange: Signal<((value: string) => void) | undefined>
	options: Signal<CoreOption[]>
	readOnly: Signal<boolean>
	Span: Signal<GenericComponent | undefined>
	Mark: Signal<GenericComponent | undefined>
	Overlay: Signal<GenericComponent | undefined>
	className: Signal<string | undefined>
	style: Signal<StyleProperties | undefined>
	baseClassName: Signal<string | undefined>
	containerClass: Computed<string | undefined>
	containerStyle: Computed<StyleProperties | undefined>
	slots: Signal<CoreSlots | undefined>
	slotProps: Signal<CoreSlotProps | undefined>
}
import {cx} from '../../shared/utils/cx'
import {merge} from '../../shared/utils/merge'
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from '../../shared/utils/resolveSlot'
import type {SlotName} from '../../shared/utils/resolveSlot'
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

function createNamedSlot(
	slots: Signal<CoreSlots | undefined>,
	slotProps: Signal<CoreSlotProps | undefined>,
	name: SlotName
): Slot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment Slot with typed overloads; core satisfies the base interface
	return {
		use: () => [resolveSlot(name, slots.use()), resolveSlotProps(name, slotProps.use())] as const,
		get: () => [resolveSlot(name, slots.get()), resolveSlotProps(name, slotProps.get())] as const,
	} as unknown as Slot
}

function createOverlaySlot(overlay: Signal<GenericComponent | undefined>): OverlaySlot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment OverlaySlot with typed overloads; core satisfies the base interface
	return {
		use: (option?: CoreOption, defaultComponent?: unknown) =>
			resolveOverlaySlot(overlay.use(), option, defaultComponent),
		get: (option?: CoreOption, defaultComponent?: unknown) =>
			resolveOverlaySlot(overlay.get(), option, defaultComponent),
	} as unknown as OverlaySlot
}

function createMarkSlot(
	options: Signal<CoreOption[]>,
	mark: Signal<GenericComponent | undefined>,
	span: Signal<GenericComponent | undefined>,
	getDefaultSpan: () => unknown
): MarkSlot {
	// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment MarkSlot with typed overloads; core satisfies the base interface
	return {
		use: (token: Token) => resolveMarkSlot(token, options.get(), mark.use(), span.use(), getDefaultSpan()),
		get: (token: Token) => resolveMarkSlot(token, options.get(), mark.get(), span.get(), getDefaultSpan()),
	} as unknown as MarkSlot
}

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

	readonly state: StoreState = {
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
		baseClassName: signal<string | undefined>(undefined),
		containerClass: computed(() =>
			cx(this.state.baseClassName(), this.state.className(), this.state.slotProps()?.container?.className)
		),
		containerStyle: computed(() => merge(this.state.style(), this.state.slotProps()?.container?.style)),

		// Slot system
		slots: signal<CoreSlots | undefined>(undefined),
		slotProps: signal<CoreSlotProps | undefined>(undefined),
	}

	readonly slot = {
		container: createNamedSlot(this.state.slots, this.state.slotProps, 'container'),
		block: createNamedSlot(this.state.slots, this.state.slotProps, 'block'),
		span: createNamedSlot(this.state.slots, this.state.slotProps, 'span'),
		overlay: createOverlaySlot(this.state.Overlay),
		mark: createMarkSlot(this.state.options, this.state.Mark, this.state.Span, () => this._defaultSpan),
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

	readonly handler = new MarkputHandler(this)

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
			const state = this.state
			for (const k in values) {
				if (typeof k !== 'string' || !(k in state)) continue
				// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous map: per-key signal types verified by SignalValues<T> at the call site
				const sig = state[k as keyof StoreState]
				if ('set' in sig) {
					// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous map: per-key signal types verified by SignalValues<T> at the call site
					sig.set(values[k as keyof typeof values] as never)
				}
			}
		})
	}
}