import {ArrowNavFeature} from '../features/arrownav'
import {BlockEditFeature} from '../features/block-editing'
import {CopyFeature} from '../features/clipboard'
import {DragFeature} from '../features/drag'
import {ContentEditableFeature} from '../features/editable'
import {SystemListenerFeature} from '../features/events'
import {FocusFeature} from '../features/focus'
import {InputFeature} from '../features/input'
import {OverlayFeature} from '../features/overlay'
import {Parser} from '../features/parsing'
import type {Token} from '../features/parsing'
import {ParseFeature} from '../features/parsing/ParseFeature'
import {TextSelectionFeature} from '../features/selection'
import {createSlots} from '../features/slots'
import {KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {signal, computed, event, batch, watch} from '../shared/signals'
import type {SignalValues} from '../shared/signals'
import type {
	CoreOption,
	OverlayMatch,
	OverlayTrigger,
	Recovery,
	CSSProperties,
	CoreSlots,
	CoreSlotProps,
	DragAction,
} from '../shared/types'
import {cx} from '../shared/utils/cx'
import {merge} from '../shared/utils/merge'
import {shallow} from '../shared/utils/shallow'
import {BlockRegistry} from './BlockRegistry'

import styles from '../../styles.module.css'

export type {DragAction} from '../shared/types'

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
		/** Fires after user input or programmatic mark change — triggers serialization, `onChange`, and re-parse */
		change: event(),
		/** Triggers a re-parse of tokens from the current content */
		parse: event(),
		/** Removes a mark token from editor content */
		delete: event<{token: Token}>(),
		/** Fires when the user selects an overlay option — annotates markup into the current input span */
		select: event<{mark: Token; match: OverlayMatch}>(),
		/** Dismisses the overlay by clearing the current `overlayMatch` */
		clearOverlay: event(),
		/** Probes the caret/text position for overlay trigger patterns and shows overlay if matched */
		checkOverlay: event(),
		/** Syncs `contentEditable` attributes and `textContent` of child elements to match token state */
		sync: event(),
		/** Restores the caret position after a DOM re-render using the saved recovery state */
		recoverFocus: event(),
		/** Dispatches drag-mode row operations (reorder, add, delete, duplicate) */
		dragAction: event<DragAction>(),
		/** Signals the framework component has received new props — triggers conditional re-parse if value/options changed */
		updated: event(),
		/** Fires after the framework has committed new token elements to the DOM — kicks off sync and focus recovery */
		afterTokensRendered: event(),
		/** Lifecycle: editor component added to the DOM — enables all features */
		mounted: event(),
		/** Lifecycle: editor component removed from the DOM — disables all features and cleans up subscriptions */
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
		parse: new ParseFeature(this),
	}

	constructor() {
		watch(this.event.mounted, () => Object.values(this.features).forEach(f => f.enable()))
		watch(this.event.unmounted, () => Object.values(this.features).forEach(f => f.disable()))
	}

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