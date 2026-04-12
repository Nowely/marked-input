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

	readonly props = {
		value: signal<string | undefined>(undefined, {readonly: true}),
		defaultValue: signal<string | undefined>(undefined, {readonly: true}),

		onChange: signal<((value: string) => void) | undefined>(undefined, {readonly: true}),

		options: signal<CoreOption[]>(DEFAULT_OPTIONS, {readonly: true}),
		readOnly: signal<boolean>(false, {readonly: true}),

		drag: signal<boolean | {alwaysShowHandle: boolean}>(false, {readonly: true}),

		showOverlayOn: signal<OverlayTrigger>('change', {readonly: true}),

		Span: signal<unknown>(undefined, {readonly: true}),
		Mark: signal<unknown>(undefined, {readonly: true}),
		Overlay: signal<unknown>(undefined, {readonly: true}),

		className: signal<string | undefined>(undefined, {readonly: true}),
		style: signal<CSSProperties | undefined>(undefined, {equals: shallow, readonly: true}),

		slots: signal<CoreSlots | undefined>(undefined, {readonly: true}),
		slotProps: signal<CoreSlotProps | undefined>(undefined, {readonly: true}),
	}

	readonly state = {
		// Data
		tokens: signal<Token[]>([]),
		previousValue: signal<string | undefined>(undefined),
		innerValue: signal<string | undefined>(undefined),
		recovery: signal<Recovery | undefined>(undefined),

		// Selection
		selecting: signal<'drag' | 'all' | undefined>(undefined),

		// Overlay (internally managed by OverlayFeature)
		overlayMatch: signal<OverlayMatch | undefined>(undefined),
		overlayTrigger: signal<((option: CoreOption) => string | undefined) | undefined>(undefined),
	}

	readonly computed = {
		hasMark: computed(() => {
			const Mark = this.props.Mark()
			if (Mark) return true
			return this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
		}),
		parser: computed(() => {
			if (!this.computed.hasMark()) return

			const markups = this.props.options().map(opt => opt.markup)
			if (!markups.some(Boolean)) return

			const isDrag = !!this.props.drag()
			return new Parser(markups, isDrag ? {skipEmptyText: true} : undefined)
		}),
		containerComponent: computed(() => resolveSlot('container', this.props.slots())),
		containerProps: computed<{className: string | undefined; style?: CSSProperties; [key: string]: unknown}>(
			prev => {
				const drag = !!this.props.drag()
				const readOnly = this.props.readOnly()
				const slotProps = this.props.slotProps()
				const containerSlotProps = slotProps?.container
				const baseStyle = merge(this.props.style(), containerSlotProps?.style)
				const style =
					drag && !readOnly ? (baseStyle ? {paddingLeft: 24, ...baseStyle} : {paddingLeft: 24}) : baseStyle
				const {className: _cls, style: _sty, ...otherSlotProps} = resolveSlotProps('container', slotProps) ?? {}
				const next = {
					className: cx(styles.Container, this.props.className(), containerSlotProps?.className),
					style,
					...otherSlotProps,
				}
				return prev && shallow(prev, next) ? prev : next
			}
		),
		blockComponent: computed(() => resolveSlot('block', this.props.slots())),
		blockProps: computed(() => resolveSlotProps('block', this.props.slotProps())),
		spanComponent: computed(() => resolveSlot('span', this.props.slots())),
		spanProps: computed(() => resolveSlotProps('span', this.props.slotProps())),
		// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment OverlaySlot with typed overloads; core satisfies the base interface
		overlay: computed(() => {
			const Overlay = this.props.Overlay()
			return (option?: CoreOption, defaultComponent?: unknown) =>
				resolveOverlaySlot(Overlay, option, defaultComponent)
		}) as unknown as OverlaySlot,
		// oxlint-disable-next-line no-unsafe-type-assertion -- framework packages augment MarkSlot with typed overloads; core satisfies the base interface
		mark: computed(() => {
			const options = this.props.options()
			const Mark = this.props.Mark()
			const Span = this.props.Span()
			return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
		}) as unknown as MarkSlot,
	}

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
			{writable: true}
		)
	}
}