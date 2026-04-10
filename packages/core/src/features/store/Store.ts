import {BlockRegistry, KeyGenerator, MarkputHandler, NodeProxy} from '../../shared/classes'
import {DEFAULT_OPTIONS} from '../../shared/constants'
import {signal, computed, event, batch} from '../../shared/signals'
import type {SignalValues} from '../../shared/signals'
import type {
	CoreOption,
	OverlayMatch,
	OverlayTrigger,
	Recovery,
	CSSProperties,
	CoreSlots,
	CoreSlotProps,
	DragAction,
} from '../../shared/types'
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

import styles from '../../../styles.module.css'

export type {DragAction} from '../../shared/types'

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
		Span: signal<unknown>(undefined),
		Mark: signal<unknown>(undefined),
		Overlay: signal<unknown>(undefined),

		// Styling
		className: signal<string | undefined>(undefined),
		style: signal<CSSProperties | undefined>(undefined, {equals: shallow}),

		// Slot system
		slots: signal<CoreSlots | undefined>(undefined),
		slotProps: signal<CoreSlotProps | undefined>(undefined),
	}

	readonly computed = {
		hasMark: computed(() => {
			const Mark = this.state.Mark()
			if (Mark) return true
			return this.state.options().some(opt => 'Mark' in opt && opt.Mark != null)
		}),
		parser: computed(() => {
			if (!this.computed.hasMark()) return

			const markups = this.state.options().map(opt => opt.markup)
			if (!markups.some(Boolean)) return

			const isDrag = !!this.state.drag()
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
			for (const key of Object.keys(values) as (keyof typeof this.state)[]) {
				if (!(key in state)) continue
				// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
				state[key](values[key] as never)
			}
		})
	}
}