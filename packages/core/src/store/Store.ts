import {CaretFeature} from '../features/caret'
import {ClipboardFeature} from '../features/clipboard'
import {DomFeature} from '../features/dom'
import {DragFeature} from '../features/drag'
import {SystemListenerFeature} from '../features/events'
import {KeyboardFeature} from '../features/keyboard'
import {LifecycleFeature} from '../features/lifecycle'
import {MarkFeature} from '../features/mark'
import {OverlayFeature} from '../features/overlay'
import type {Parser, Token} from '../features/parsing'
import {ParsingFeature} from '../features/parsing/ParseFeature'
import type {MarkSlot, OverlaySlot} from '../features/slots'
import {SlotsFeature} from '../features/slots'
import {ValueFeature} from '../features/value'
import {KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {signal, batch, watch} from '../shared/signals'
import type {SignalValues, Computed, Signal, Event} from '../shared/signals'
import type {
	CoreOption,
	OverlayMatch,
	OverlayTrigger,
	Recovery,
	CSSProperties,
	CoreSlots,
	CoreSlotProps,
	DragAction,
	DraggableConfig,
	Slot,
} from '../shared/types'
import {shallow} from '../shared/utils/shallow'
import {BlockRegistry} from './BlockRegistry'

export type {DragAction} from '../shared/types'

export class Store {
	readonly key = new KeyGenerator()
	readonly blocks = new BlockRegistry()

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly props = {
		value: signal<string | undefined>(undefined, {readonly: true}),
		defaultValue: signal<string | undefined>(undefined, {readonly: true}),

		onChange: signal<((value: string) => void) | undefined>(undefined, {readonly: true}),

		options: signal<CoreOption[]>(DEFAULT_OPTIONS, {readonly: true}),
		readOnly: signal<boolean>(false, {readonly: true}),

		layout: signal<'inline' | 'block'>('inline', {readonly: true}),
		draggable: signal<boolean | DraggableConfig>(false, {readonly: true}),

		showOverlayOn: signal<OverlayTrigger>('change', {readonly: true}),

		Span: signal<Slot | undefined>(undefined, {readonly: true}),
		Mark: signal<Slot | undefined>(undefined, {readonly: true}),
		Overlay: signal<Slot | undefined>(undefined, {readonly: true}),

		className: signal<string | undefined>(undefined, {readonly: true}),
		style: signal<CSSProperties | undefined>(undefined, {equals: shallow, readonly: true}),

		slots: signal<CoreSlots | undefined>(undefined, {readonly: true}),
		slotProps: signal<CoreSlotProps | undefined>(undefined, {readonly: true}),
	}

	readonly state: {
		tokens: Signal<Token[]>
		previousValue: Signal<string | undefined>
		innerValue: Signal<string | undefined>
		recovery: Signal<Recovery | undefined>
		container: Signal<HTMLDivElement | null>
		overlay: Signal<HTMLElement | null>
		selecting: Signal<'drag' | 'all' | undefined>
		overlayMatch: Signal<OverlayMatch | undefined>
	}

	readonly computed: {
		hasMark: Computed<boolean>
		isBlock: Computed<boolean>
		isDraggable: Computed<boolean>
		parser: Computed<Parser | undefined>
		currentValue: Computed<string>
		containerComponent: Computed<Slot>
		containerProps: Computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}>
		blockComponent: Computed<Slot>
		blockProps: Computed<Record<string, unknown> | undefined>
		spanComponent: Computed<Slot>
		spanProps: Computed<Record<string, unknown> | undefined>
		overlay: OverlaySlot
		mark: MarkSlot
	}

	readonly emit: {
		change: Event<void>
		reparse: Event<void>
		markRemove: Event<{token: Token}>
		overlaySelect: Event<{mark: Token; match: OverlayMatch}>
		overlayClose: Event<void>
		sync: Event<void>
		drag: Event<DragAction>
		rendered: Event<void>
		mounted: Event<void>
		unmounted: Event<void>
	}

	readonly handler = new MarkputHandler(this)

	readonly feature: {
		lifecycle: LifecycleFeature
		value: ValueFeature
		overlay: OverlayFeature
		mark: MarkFeature
		slots: SlotsFeature
		caret: CaretFeature
		keyboard: KeyboardFeature
		system: SystemListenerFeature
		dom: DomFeature
		drag: DragFeature
		clipboard: ClipboardFeature
		parsing: ParsingFeature
	}

	constructor() {
		const lifecycle = new LifecycleFeature(this)
		const value = new ValueFeature(this)
		const parsing = new ParsingFeature(this)
		const mark = new MarkFeature(this)
		const overlay = new OverlayFeature(this)
		const slots = new SlotsFeature(this)
		const drag = new DragFeature(this)
		const caret = new CaretFeature(this)
		const dom = new DomFeature(this)

		this.state = {
			tokens: parsing.state.tokens,
			previousValue: value.state.previousValue,
			innerValue: value.state.innerValue,
			recovery: caret.state.recovery,
			container: slots.state.container,
			overlay: overlay.state.overlay,
			selecting: caret.state.selecting,
			overlayMatch: overlay.state.overlayMatch,
		}

		this.computed = {
			hasMark: mark.computed.hasMark,
			isBlock: slots.computed.isBlock,
			isDraggable: slots.computed.isDraggable,
			parser: parsing.computed.parser,
			currentValue: value.computed.currentValue,
			containerComponent: slots.computed.containerComponent,
			containerProps: slots.computed.containerProps,
			blockComponent: slots.computed.blockComponent,
			blockProps: slots.computed.blockProps,
			spanComponent: slots.computed.spanComponent,
			spanProps: slots.computed.spanProps,
			overlay: overlay.computed.overlay,
			mark: mark.computed.mark,
		}

		this.emit = {
			change: value.emit.change,
			reparse: parsing.emit.reparse,
			markRemove: mark.emit.markRemove,
			overlaySelect: overlay.emit.overlaySelect,
			overlayClose: overlay.emit.overlayClose,
			sync: dom.emit.reconcile,
			drag: drag.emit.drag,
			rendered: lifecycle.emit.rendered,
			mounted: lifecycle.emit.mounted,
			unmounted: lifecycle.emit.unmounted,
		}

		this.feature = {
			lifecycle,
			value,
			mark,
			overlay,
			slots,
			caret,
			keyboard: new KeyboardFeature(this),
			system: new SystemListenerFeature(this),
			dom,
			drag,
			clipboard: new ClipboardFeature(this),
			parsing,
		}

		watch(this.feature.lifecycle.emit.mounted, () => Object.values(this.feature).forEach(f => f.enable()))
		watch(this.feature.lifecycle.emit.unmounted, () => Object.values(this.feature).forEach(f => f.disable()))
	}

	setProps(values: Partial<SignalValues<typeof this.props>>): void {
		batch(
			() => {
				const props = this.props
				// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
				for (const key of Object.keys(values) as (keyof typeof this.props)[]) {
					if (!(key in props)) continue
					// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
					props[key](values[key] as never)
				}
			},
			{mutable: true}
		)
	}
}