import {computed, effect, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import type {OverlayRow} from '../../shared/types'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import {filterSuggestions, suggestionLabel} from './filterSuggestions'
import type {OverlayController} from './OverlayController'
import {navigateSuggestions} from './suggestionNavigation'

/**
 * THE LIST an open overlay offers, and the ONE of it: the rows, the highlighted row, and the
 * keyboard protocol between them. Both adapters render it as pure paint.
 *
 * It used to be two — `SuggestionsModel` over `overlay.data` with arrows and Enter, and
 * `OverlayController.entries` over the options' own `menu` specs with neither — and the split was
 * not a design: the same trigger grammar opened them, the same popup painted them, and only one
 * of them could be driven by a keyboard. Typing `/h2` and pressing Enter left the literal `/h2`
 * in the row and split it. One model, so a row's SOURCE is the only difference left between them.
 *
 * WHICH SOURCE is the matched option's own answer: an option that declares `overlay.data` offers
 * that data, and an option that declares none offers the ROW MENU — every option carrying a
 * {@link MenuSpec}, which is the whole registry there is. So `{overlay: {trigger: '/'}}` is the
 * entire wiring of a block menu, where it used to also need a component.
 *
 * A custom Overlay component never calls {@link activate}, so none of the keyboard wiring runs
 * for one; `useOverlay().activate` is how it opts in.
 */
export class OverlayListModel {
	/**
	 * Index into {@link rows} of the highlighted row; NaN when none is. `Object.is` because
	 * NaN !== NaN would turn every reset into a change.
	 */
	readonly active: Signal<number> = signal({initial: NaN, equals: Object.is})

	/**
	 * The rows on offer, already narrowed by what was typed after the trigger. The query pass is
	 * {@link filterSuggestions} on BOTH arms — one rule for "does this row match what was typed",
	 * over a suggestion's label or over a menu entry's label plus its own hidden keywords.
	 */
	readonly rows: Computed<readonly OverlayRow[]> = computed(() => {
		const match = this.overlay.match()
		if (!match) return []
		const data = match.option.overlay?.data
		// DECLARED, not non-empty: `data: []` is a list that currently offers nothing, and an
		// option saying so must not fall through to the row menu instead.
		if (data !== undefined) {
			return filterSuggestions(data, match.value).map((row, index) => ({
				label: suggestionLabel(row),
				// A row that carries its own identity writes it; a bare string has none, so the
				// row's INDEX stands in — what the string-only shape always wrote, and the only
				// meta a list of labels can offer.
				pick: typeof row === 'string' ? {value: row, meta: String(index)} : {value: row.value, meta: row.meta},
			}))
		}
		return this.props.options().flatMap(option => {
			const menu = option.menu
			if (!menu) return []
			const haystack = [menu.label, ...(menu.keywords ?? [])]
			if (filterSuggestions(haystack, match.value).length === 0) return []
			return [{label: menu.label, pick: {option}}]
		})
	})

	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly overlay: OverlayController
	) {
		// A new match means new rows: a surviving highlight could name a different row, or one
		// past the end of the narrowed list.
		watch(this.overlay.match, () => this.active(NaN))
	}

	/** Choose `rows()[index]`. Out of range chooses nothing. */
	select(index: number): void {
		const rows = this.rows()
		// `in`, not `rows[index] === undefined`: without noUncheckedIndexedAccess the indexed
		// read is typed plain `OverlayRow`, which folds that comparison into a constant.
		if (!(index in rows)) return
		this.overlay.choose(rows[index].pick)
	}

	/**
	 * Will the protocol below take this key? Asked by the ROW KEYMAP, which is bound to the same
	 * container at editor setup and therefore runs FIRST — {@link activate} adds its listener when
	 * the popup mounts, later, same element, same phase. Without this, Enter over a highlighted
	 * row split the row instead of choosing it (`'ping @Mi'` + ArrowDown + Enter emitted
	 * `'ping @Mi⏎'`, no mention), because by the time the protocol ran there was no match left.
	 *
	 * It is `navigateSuggestions` and nothing else, so the answer cannot drift from what the
	 * handler does with the same key: `'none'` — no rows, or Enter with nothing highlighted —
	 * means the key is free and the split still reaches it.
	 */
	consumes(key: string): boolean {
		return navigateSuggestions(key, this.active(), this.rows().length).action !== 'none'
	}

	/**
	 * Bind the keyboard protocol (arrows move `active`, Enter selects) to the host container
	 * and return the unbind. The built-in overlay component calls this on mount, so the listener
	 * exists exactly while the built-in list is shown.
	 *
	 * An arrow field, so an adapter can hand it out through `useOverlay()` unbound.
	 */
	readonly activate = (): (() => void) =>
		effect(() => {
			const container = this.host.container()
			if (!container) return
			const onKeydown = (event: KeyboardEvent) => {
				const result = navigateSuggestions(event.key, this.active(), this.rows().length)
				if (result.action === 'none') return
				event.preventDefault()
				if (result.action === 'select') this.select(result.index)
				else this.active(result.index)
			}
			container.addEventListener('keydown', onKeydown)
			return () => container.removeEventListener('keydown', onKeydown)
		})
}