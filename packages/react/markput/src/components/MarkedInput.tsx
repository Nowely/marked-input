import type {CoreOption, DraggableConfig, MarkputHandle, OverlayTrigger} from '@markput/core'
import {Store} from '@markput/core'
import type {ComponentType, CSSProperties, Ref} from 'react'
import {useImperativeHandle, useLayoutEffect, useState} from 'react'

import {StoreContext} from '../lib/providers/StoreContext'
import type {MarkProps, Option, OverlayProps, SlotProps, Slots, SpanProps} from '../types'
import {Container} from './Container'
import {OverlayRenderer} from './OverlayRenderer'

/**
 * Props for MarkedInput component.
 *
 * @template TMarkProps - Type of props for the global Mark component
 * @template TOverlayProps - Type of props for the global Overlay component
 *
 * @example
 * ```tsx
 * <MarkedInput<ChipProps>
 *   Mark={Chip}
 *   options={[{
 *     markup: '@[__value__]',
 *     mark: { label: 'Click me' }
 *   }]}
 * />
 * ```
 */
export interface MarkedInputProps<TMarkProps = MarkProps, TOverlayProps extends CoreOption['overlay'] = OverlayProps> {
	/** Ref to the editor API (spec §2.3) */
	ref?: Ref<MarkputHandle>
	/** Global component used for rendering text tokens (default: built-in Span) */
	Span?: ComponentType<SpanProps>
	/** Global component used for rendering markups (fallback for option.Mark) */
	Mark?: ComponentType<TMarkProps>
	/** Global component used for rendering overlays (fallback for option.Overlay) */
	Overlay?: ComponentType<TOverlayProps>
	/**
	 * Configuration options for markups and overlays.
	 * Each option can specify its own component via option.Mark or option.Overlay.
	 * Falls back to global Mark/Overlay components when not specified.
	 */
	options?: Option<TMarkProps, TOverlayProps>[]
	/** Additional classes */
	className?: string
	/** Additional style */
	style?: CSSProperties
	/**
	 * Override internal components using slots
	 * @example slots={{ container: 'div' }}
	 */
	slots?: Slots
	/**
	 * Props to pass to slot components
	 * @example slotProps={{ container: { onKeyDown: handler } }}
	 */
	slotProps?: SlotProps
	/**
	 * Events that trigger overlay display
	 * @default 'change'
	 */
	showOverlayOn?: OverlayTrigger
	/** Annotated text with markups */
	value?: string
	/**
	 * Initial value for uncontrolled mode — the value the editor starts from when no `value`
	 * prop is given. It is read once: setting it later does not move an editor that already
	 * holds a value, and it is NOT what a controlled editor reverts to. Dropping `value`
	 * (passing `undefined` after a string) keeps whatever is on screen; to go back to some
	 * earlier text, pass it.
	 */
	defaultValue?: string
	/** Change event handler */
	onChange?: (value: string) => void
	/** Read-only mode */
	readOnly?: boolean
	/**
	 * The structural row separator (issue 08, ADR-0011): editor-level, never part of any markup,
	 * and the whole of what makes a document rows. Each piece between two separators is a row,
	 * with its own drag grip and row menu.
	 *
	 * `null` says the value never splits: one document, no rows, no row controls — a plain
	 * annotated text field.
	 *
	 * An empty string separates nothing: the editor reports it and renders the document as if it
	 * were `null`.
	 * @default '\n'
	 */
	separator?: string | null
	/**
	 * The indent unit a NESTED row leads with (ADR-0010): editor-level like `separator`, and
	 * structural in the same sense — a leading run of it at a row's own start belongs to no
	 * markup and no caret may enter it.
	 *
	 * `''` turns nesting off, and with it row TYPING on every indented line: a line whose first
	 * character is not an opener is a paragraph. Pass it when the document stores leading
	 * indentation as content.
	 * @default '\t'
	 */
	indent?: string
	/**
	 * Does the editor keep its own undo stack (ADR-0012). Ctrl/Cmd+Z undoes and Shift+Ctrl/Cmd+Z
	 * redoes, in both value modes — in a controlled editor an entry is recorded only once the
	 * parent has echoed the value back, so an emission your `onChange` declines leaves nothing
	 * behind.
	 *
	 * `false` turns both keys back into no-ops. It does NOT hand undo to the browser: the input
	 * guard has swallowed native undo since ADR-0006, because a native undo would edit DOM the
	 * model owns.
	 * @default true
	 */
	history?: boolean
	/** Enable drag interaction on rows. Ineffective when `separator` is `null`.
	 * @default false
	 */
	draggable?: boolean | DraggableConfig
}

export function MarkedInput<TMarkProps = MarkProps, TOverlayProps extends CoreOption['overlay'] = OverlayProps>(
	props: MarkedInputProps<TMarkProps, TOverlayProps>
) {
	const [store] = useState(() => {
		const nextStore = new Store()
		nextStore.props.set(props)
		return nextStore
	})

	useLayoutEffect(() => {
		// `sync`, not `set`: React hands us only the props the caller wrote, so a prop that was
		// dropped between renders has to revert to its default rather than keep its last value.
		store.props.set(props)
	})

	useImperativeHandle(props.ref, () => store.handle, [store])

	return (
		<StoreContext value={store}>
			<Container />
			<OverlayRenderer />
		</StoreContext>
	)
}