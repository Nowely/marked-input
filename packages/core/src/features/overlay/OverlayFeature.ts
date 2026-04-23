import {KEYBOARD} from '../../shared/constants'
import {signal, computed, event, effectScope, effect, watch, listen} from '../../shared/signals/index.js'
import type {CoreOption, Feature, OverlayMatch, OverlayTrigger, Slot} from '../../shared/types'
import type {Store} from '../../store/Store'
import {TriggerFinder} from '../caret'
import {createNewSpan} from '../editing'
import type {Token} from '../parsing'
import {annotate, toString} from '../parsing'
import {resolveOverlaySlot} from '../slots'
import type {OverlaySlot} from '../slots'

export class OverlayFeature implements Feature {
	readonly overlayMatch = signal<OverlayMatch | undefined>(undefined)
	readonly overlay = signal<HTMLElement | null>(null)

	readonly overlaySlot: OverlaySlot = computed(() => {
		const Overlay = this._store.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) => resolveOverlaySlot(Overlay, option, defaultComponent)
	})

	readonly overlaySelect = event<{mark: Token; match: OverlayMatch}>()
	readonly overlayClose = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	#probeTrigger() {
		const match = TriggerFinder.find(this._store.props.options(), option => option.overlay?.trigger)
		this.overlayMatch(match)
	}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			watch(this.overlayClose, () => {
				this.overlayMatch(undefined)
			})

			watch(this._store.feature.value.change, () => {
				const showOverlayOn = this._store.props.showOverlayOn()
				const type: OverlayTrigger = 'change'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			})

			effect(() => {
				const match = this.overlayMatch()
				if (match) {
					this._store.nodes.input.target = this._store.nodes.focus.target

					listen(window, 'keydown', e => {
						if (e.key === KEYBOARD.ESC) {
							this.overlayClose()
						}
					})

					listen(
						document,
						'click',
						e => {
							const target = e.target instanceof HTMLElement ? e.target : null
							if (this.overlay()?.contains(target)) return
							if (this._store.feature.slots.container()?.contains(target)) return
							this.overlayClose()
						},
						true
					)
				}
			})

			const selectionChangeHandler = () => {
				const container = this._store.feature.slots.container()
				if (!container?.contains(document.activeElement)) return

				const showOverlayOn = this._store.props.showOverlayOn()
				const type: OverlayTrigger = 'selectionChange'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			}

			listen(document, 'selectionchange', selectionChangeHandler)

			watch(this.overlaySelect, overlayEvent => {
				const Mark = this._store.props.Mark()
				const onChange = this._store.props.onChange()
				const {
					mark,
					match: {option, span, index, source},
				} = overlayEvent

				const markup = option.markup
				if (!markup) return

				const annotation =
					mark.type === 'mark'
						? annotate(markup, {
								value: mark.value,
								meta: mark.meta,
							})
						: annotate(markup, {
								value: mark.content,
							})

				const newSpan = createNewSpan(span, annotation, index, source)

				this._store.feature.caret.recovery(
					Mark
						? {
								caret: 0,
								anchor: this._store.nodes.input.next,
								isNext: true,
								childIndex: this._store.nodes.input.index,
							}
						: {caret: index + annotation.length, anchor: this._store.nodes.input}
				)

				if (this._store.nodes.input.target) {
					this._store.nodes.input.content = newSpan
					const tokens = this._store.feature.parsing.tokens()
					const inputToken = tokens[this._store.nodes.input.index]
					if (inputToken.type === 'text') {
						inputToken.content = newSpan
					}

					this._store.nodes.focus.target = this._store.nodes.input.target
					this._store.nodes.input.clear()
					onChange?.(toString(tokens))
					this._store.feature.parsing.reparse()
				}
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}