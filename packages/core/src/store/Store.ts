import {CaretFeature} from '../features/caret'
import {ClipboardFeature} from '../features/clipboard'
import {DomFeature} from '../features/dom'
import {DragFeature} from '../features/drag'
import {KeyboardFeature} from '../features/keyboard'
import {LifecycleFeature} from '../features/lifecycle'
import {MarkFeature} from '../features/mark'
import {OverlayFeature} from '../features/overlay'
import {ParsingFeature} from '../features/parsing/ParseFeature'
import {SlotsFeature} from '../features/slots'
import {ValueFeature} from '../features/value'
import {KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {signal, batch, watch} from '../shared/signals'
import type {SignalValues} from '../shared/signals'
import type {
	CoreOption,
	OverlayTrigger,
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

	readonly handler = new MarkputHandler(this)

	readonly feature: {
		lifecycle: LifecycleFeature
		value: ValueFeature
		overlay: OverlayFeature
		mark: MarkFeature
		slots: SlotsFeature
		caret: CaretFeature
		keyboard: KeyboardFeature
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

		this.feature = {
			lifecycle,
			value,
			mark,
			overlay,
			slots,
			caret,
			keyboard: new KeyboardFeature(this),
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