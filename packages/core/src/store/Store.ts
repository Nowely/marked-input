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
import {resolveMarkSlot, resolveOverlaySlot, resolveSlot, resolveSlotProps} from '../features/slots'
import type {MarkSlot, OverlaySlot} from '../features/slots'
import {KeyGenerator, MarkputHandler, NodeProxy} from '../shared/classes'
import {DEFAULT_OPTIONS} from '../shared/constants'
import {signal, computed, event, batch, watch} from '../shared/signals'
import type {SignalValues, Computed} from '../shared/signals'
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
import {cx} from '../shared/utils/cx'
import {merge} from '../shared/utils/merge'
import {shallow} from '../shared/utils/shallow'
import {BlockRegistry} from './BlockRegistry'

import styles from '../../styles.module.css'

export type {DragAction} from '../shared/types'

const DRAG_HANDLE_WIDTH = 24

function buildContainerProps(
	isDraggableBlock: boolean,
	readOnly: boolean,
	className: string | undefined,
	style: CSSProperties | undefined,
	slotProps: CoreSlotProps | undefined
): {className: string | undefined; style?: CSSProperties; [key: string]: unknown} {
	const containerSlotProps = slotProps?.container
	const baseStyle = merge(style, containerSlotProps?.style)
	const mergedStyle = isDraggableBlock && !readOnly ? {paddingLeft: DRAG_HANDLE_WIDTH, ...baseStyle} : baseStyle

	const {className: _, style: __, ...otherSlotProps} = resolveSlotProps('container', slotProps) ?? {}

	return {
		className: cx(styles.Container, className, containerSlotProps?.className),
		style: mergedStyle,
		...otherSlotProps,
	}
}

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

	readonly state = {
		tokens: signal<Token[]>([]),
		previousValue: signal<string | undefined>(undefined),
		innerValue: signal<string | undefined>(undefined),
		recovery: signal<Recovery | undefined>(undefined),

		container: signal<HTMLDivElement | null>(null),
		overlay: signal<HTMLElement | null>(null),

		selecting: signal<'drag' | 'all' | undefined>(undefined),

		overlayMatch: signal<OverlayMatch | undefined>(undefined),
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
	} = {
		hasMark: computed(() => {
			const Mark = this.props.Mark()
			if (Mark) return true
			return this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
		}),
		isBlock: computed(() => this.props.layout() === 'block'),
		isDraggable: computed(() => !!this.props.draggable()),
		parser: computed(() => {
			if (!this.computed.hasMark()) return

			const markups = this.props.options().map(opt => opt.markup)
			if (!markups.some(Boolean)) return

			return new Parser(markups, this.computed.isBlock() ? {skipEmptyText: true} : undefined)
		}),
		currentValue: computed(() => this.state.previousValue() ?? this.props.value() ?? ''),
		containerComponent: computed(() => resolveSlot('container', this.props.slots())),
		containerProps: computed(
			() =>
				buildContainerProps(
					this.computed.isDraggable() && this.computed.isBlock(),
					this.props.readOnly(),
					this.props.className(),
					this.props.style(),
					this.props.slotProps()
				),
			{equals: shallow}
		),
		blockComponent: computed(() => resolveSlot('block', this.props.slots())),
		blockProps: computed(() => resolveSlotProps('block', this.props.slotProps())),
		spanComponent: computed(() => resolveSlot('span', this.props.slots())),
		spanProps: computed(() => resolveSlotProps('span', this.props.slotProps())),
		overlay: computed(() => {
			const Overlay = this.props.Overlay()
			return (option?: CoreOption, defaultComponent?: Slot) =>
				resolveOverlaySlot(Overlay, option, defaultComponent)
		}),
		mark: computed(() => {
			const options = this.props.options()
			const Mark = this.props.Mark()
			const Span = this.props.Span()
			return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
		}),
	}

	readonly event = {
		/** Fires after user input or programmatic mark change — triggers serialization, `onChange`, and re-parse */
		change: event(),
		/** Triggers a re-parse of tokens from the current content */
		reparse: event(),
		/** Removes a mark token from editor content */
		markRemove: event<{token: Token}>(),
		/** Fires when the user selects an overlay option — annotates markup into the current input span */
		overlaySelect: event<{mark: Token; match: OverlayMatch}>(),
		/** Dismisses the overlay by clearing the current `overlayMatch` */
		overlayClose: event(),
		/** Post-render DOM alignment: aligns `contentEditable` attributes and `textContent` of child elements to token state. Emitted synchronously by `FocusFeature` inside the `rendered` handler (framework layout-effect phase). Load-bearing for post-commit DOM consistency — do not delete without reproducing this timing. */
		sync: event(),
		/** Dispatches drag-mode row operations (reorder, add, delete, duplicate) */
		drag: event<DragAction>(),
		/** Fires after the framework has committed new token elements to the DOM — kicks off sync and focus recovery */
		rendered: event(),
		/** Lifecycle: editor component added to the DOM — enables all features */
		mounted: event(),
		/** Lifecycle: editor component removed from the DOM — disables all features and cleans up subscriptions */
		unmounted: event(),
	}

	readonly handler = new MarkputHandler(this)

	readonly feature = {
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
		watch(this.event.mounted, () => Object.values(this.feature).forEach(f => f.enable()))
		watch(this.event.unmounted, () => Object.values(this.feature).forEach(f => f.disable()))
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