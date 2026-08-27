import type {OverlayMatch, OverlayPick, OverlayRow} from '@markput/core'
import type {RefObject} from 'react'

import type {Option} from '../../types'
import {useMarkput} from './useMarkput'

export interface OverlayHandler<TElement extends HTMLElement = HTMLElement> {
	style: {
		left: number
		top: number
	}
	close: () => void
	select: (value: {value: string; meta?: string}) => void
	/**
	 * THE LIST the open overlay offers, already narrowed by what was typed after the trigger: the
	 * matched option's `overlay.data` when it declares any, and the ROW MENU — every option
	 * carrying a `menu` — when it declares none. An overlay component filters nothing and knows
	 * neither source; it paints `label` and hands `pick` back to {@link OverlayHandler.choose}.
	 */
	rows: readonly OverlayRow[]
	/** Index into {@link OverlayHandler.rows} of the highlighted row; NaN when none is. */
	active: number
	/**
	 * Bind the list's keyboard protocol — arrows move the highlight, Enter chooses — to the
	 * editing host, and return the unbind. OPT-IN, because an overlay that is not a list must not
	 * swallow those keys: the built-in component calls it on mount, and a custom one calls it to
	 * get the same contract.
	 */
	activate: () => () => void
	/**
	 * The one accept path. `{option}` turns the caret's row into that option's row kind and
	 * removes the trigger in the same splice; `{value, meta}` writes the trigger option's markup,
	 * which is what {@link select} does.
	 */
	choose: (pick: OverlayPick) => boolean
	match: OverlayMatch<Option> | undefined
	/**
	 * THE OVERLAY'S OWN ELEMENT, handed back so core can measure the popup and flip it above the
	 * caret when it does not fit below. A consumer attaches it to whatever element it paints.
	 *
	 * IT IS THE ELEMENT'S TYPE, not `HTMLElement`, and that is what the parameter is for. React's
	 * `ref` prop is invariant — `{current: HTMLElement | null}` is not a `Ref<HTMLDivElement>` —
	 * so a handler that could only ever answer the base type made every consumer of a concrete
	 * element write an assertion or a callback ref around it. `useOverlay<HTMLDivElement>()` is
	 * the same object with the type the consumer already knows.
	 */
	ref: RefObject<TElement | null>
}

export function useOverlay<TElement extends HTMLElement = HTMLElement>(): OverlayHandler<TElement> {
	const {match, rows, active, overlay} = useMarkput(s => ({
		match: s.overlay.match,
		rows: s.overlay.list.rows,
		active: s.overlay.list.active,
		overlay: s.overlay,
	}))

	// THE COMPUTED, not its value. `useMarkput` calls its selector ONCE, so `position()` handed
	// back a plain `{left, top}` that was then frozen for the whole life of the overlay component
	// — and the component is keyed by the matched OPTION, so it does not remount between
	// keystrokes. The popup therefore stayed at the position it opened at, and the flip below,
	// which is decided only once the popup has a measured size, could never be applied at all.
	const style = useMarkput(s => s.overlay.position)

	// close/select/choose/activate/ref are framework-free glue and live on the controller; only
	// the reactive match/rows/active/style bindings are React's.
	return {
		match,
		rows,
		active,
		style,
		select: overlay.select,
		choose: overlay.choose,
		activate: overlay.list.activate,
		close: overlay.close,
		// The one erasure, kept HERE rather than at every consumer: core stores the element as an
		// `HTMLElement`, which is all it does with it — measure it — and the parameter says which
		// element the consumer will put there. The same contract `useRef<T>()` has.
		// oxlint-disable-next-line no-unsafe-type-assertion
		ref: overlay.ref as RefObject<TElement | null>,
	}
}