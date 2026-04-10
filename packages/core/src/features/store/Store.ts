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
	CSSProperties,
	CoreSlots,
	CoreSlotProps,
	DragAction,
} from '../../shared/types'

import styles from '../../../styles.module.css'

type StoreState = {
	tokens: Signal<Token[]>
	value: Signal<string | undefined>
	defaultValue: Signal<string | undefined>
	previousValue: Signal<string | undefined>
	innerValue: Signal<string | undefined>
	recovery: Signal<Recovery | undefined>
	selecting: Signal<'drag' | 'all' | undefined>
	drag: Signal<boolean | {alwaysShowHandle: boolean}>
	overlayMatch: Signal<OverlayMatch | undefined>
	overlayTrigger: Signal<((option: CoreOption) => string | undefined) | undefined>
	showOverlayOn: Signal<OverlayTrigger>
	onChange: Signal<((value: string) => void) | undefined>
	options: Signal<CoreOption[]>
	readOnly: Signal<boolean>
	Span: Signal<GenericComponent | undefined>
	Mark: Signal<GenericComponent | undefined>
	Overlay: Signal<GenericComponent | undefined>
	className: Signal<string | undefined>
	style: Signal<CSSProperties | undefined>
	slots: Signal<CoreSlots | undefined>
	slotProps: Signal<CoreSlotProps | undefined>
}
type StoreComputed = {
	parser: Computed<Parser | undefined>
	containerClass: Computed<string | undefined>
	containerStyle: Computed<CSSProperties | undefined>
}
import {cx} from '../../shared/utils/cx'
import {merge} from '../../shared/utils/merge'
import {shallow} from '../../shared/utils/shallow'
import {ArrowNavFeature} from '../arrownav'
import {BlockEditFeature} from '../block-editing'
import {CopyFeature} from '../clipboard'
import {DragFeature} from '../drag'
import {ContentEditableFeature} from '../editable'
import {SystemListenerFeature} from '../events'
import {FocusFeature} from '../focus'
import {InputFeature} from '../input'
import {Lifecycle} from '../lifecycle'
import {OverlayFeature} from '../overlay'
import {Parser} from '../parsing'
import type {Token} from '../parsing'
import {TextSelectionFeature} from '../selection'
import {createSlots} from '../slots'

export type {DragAction} from '../../shared/types'

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
		value: signal<string | undefined>(undefined),
		defaultValue: signal<string | undefined>(undefined),
		previousValue: signal<string | undefined>(undefined),
		innerValue: signal<string | undefined>(undefined),
		recovery: signal<Recovery | undefined>(undefined),

		// Selection
		selecting: signal<'drag' | 'all' | undefined>(undefined),
		drag: signal<boolean | {alwaysShowHandle: boolean}>(false),

		// Overlay
		overlayMatch: signal<OverlayMatch | undefined>(undefined),
		overlayTrigger: signal<((option: CoreOption) => string | undefined) | undefined>(undefined),
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
		style: signal<CSSProperties | undefined>(undefined, {equals: shallow}),

		// Slot system
		slots: signal<CoreSlots | undefined>(undefined),
		slotProps: signal<CoreSlotProps | undefined>(undefined),
	}

	readonly computed: StoreComputed = {
		parser: computed(() => {
			const Mark = this.state.Mark.get()
			const coreOptions = this.state.options.get()
			const hasPerOptionMark = (coreOptions as unknown[] | undefined)?.some(
				opt =>
					typeof opt === 'object' &&
					opt !== null &&
					'Mark' in opt &&
					(opt as Record<string, unknown>).Mark != null
			)
			const effectiveOptions = Mark || hasPerOptionMark ? coreOptions : undefined
			const markups = effectiveOptions?.map(opt => opt.markup)
			if (!markups?.some(Boolean)) return undefined
			const isDrag = !!this.state.drag.get()
			return new Parser(markups, isDrag ? {skipEmptyText: true} : undefined)
		}),
		containerClass: computed(() =>
			cx(styles.Container, this.state.className(), this.state.slotProps()?.container?.className)
		),
		containerStyle: computed(prev => {
			const next = merge(this.state.style(), this.state.slotProps()?.container?.style)
			return prev && shallow(prev, next) ? prev : next
		}),
	}

	readonly slot = createSlots({
		slots: this.state.slots,
		slotProps: this.state.slotProps,
		Overlay: this.state.Overlay,
		options: this.state.options,
		Mark: this.state.Mark,
		Span: this.state.Span,
	})

	readonly event = {
		change: event(),
		parse: event(),
		delete: event<{token: Token}>(),
		select: event<{mark: Token; match: OverlayMatch}>(),
		clearOverlay: event(),
		checkOverlay: event(),
		sync: event(),
		recoverFocus: event(),
		dragAction: event<DragAction>(),
		updated: event(),
		afterTokensRendered: event(),
		unmounted: event(),
	}

	readonly refs = {
		container: null as HTMLDivElement | null,
		overlay: null as HTMLElement | null,
	}

	readonly handler = new MarkputHandler(this)

	readonly features = {
		overlay: new OverlayFeature(this),
		focus: new FocusFeature(this),
		input: new InputFeature(this),
		blockEditing: new BlockEditFeature(this),
		arrowNav: new ArrowNavFeature(this),
		system: new SystemListenerFeature(this),
		textSelection: new TextSelectionFeature(this),
		contentEditable: new ContentEditableFeature(this),
		drag: new DragFeature(this),
		copy: new CopyFeature(this),
	}

	readonly lifecycle = new Lifecycle(this)

	setState(values: Partial<SignalValues<typeof this.state>>): void {
		batch(() => {
			const state = this.state
			// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
			for (const key of Object.keys(values) as (keyof StoreState)[]) {
				if (!(key in state)) continue
				// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
				state[key].set(values[key] as never)
			}
		})
	}
}