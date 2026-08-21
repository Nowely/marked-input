import {computed, effect, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import type {Host} from '../state/Host'
import {filterSuggestions} from './filterSuggestions'
import type {OverlayController} from './OverlayController'
import {navigateSuggestions} from './suggestionNavigation'

/**
 * State of the BUILT-IN Suggestions overlay: the filtered rows, the highlighted row, and the
 * keyboard protocol between them. Both adapters render it as pure paint. A custom Overlay
 * component never calls `activate()`, so none of the keyboard wiring runs for one.
 */
export class SuggestionsModel {
	/**
	 * Index into `filtered` of the highlighted row; NaN when none is. `Object.is` because
	 * NaN !== NaN would turn every reset into a change.
	 */
	readonly active: Signal<number> = signal({initial: NaN, equals: Object.is})

	readonly filtered: Computed<string[]> = computed(() => {
		const match = this.overlay.match()
		return match ? filterSuggestions(match.option.overlay?.data ?? [], match.value) : []
	})

	constructor(
		private readonly host: Host,
		private readonly overlay: OverlayController
	) {
		// A new match means new rows: a surviving highlight could name a different row, or one
		// past the end of the narrowed list.
		watch(this.overlay.match, () => this.active(NaN))
	}

	/** Choose `filtered[index]` with the index as meta. Out of range chooses nothing. */
	select(index: number): void {
		const rows = this.filtered()
		// `in`, not `rows[index] === undefined`: without noUncheckedIndexedAccess the indexed
		// read is typed plain `string`, which folds that comparison into a constant.
		if (!(index in rows)) return
		this.overlay.choose(rows[index], String(index))
	}

	/**
	 * Bind the keyboard protocol (arrows move `active`, Enter selects) to the host container
	 * and return the unbind. The default Suggestions component calls this on mount, so the
	 * listener exists exactly while the built-in overlay is shown.
	 */
	activate(): () => void {
		return effect(() => {
			const container = this.host.container()
			if (!container) return
			const onKeydown = (event: KeyboardEvent) => {
				const result = navigateSuggestions(event.key, this.active(), this.filtered().length)
				if (result.action === 'none') return
				event.preventDefault()
				if (result.action === 'select') this.select(result.index)
				else this.active(result.index)
			}
			container.addEventListener('keydown', onKeydown)
			return () => container.removeEventListener('keydown', onKeydown)
		})
	}
}