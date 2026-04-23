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
	readonly match = signal<OverlayMatch | undefined>(undefined)
	readonly element = signal<HTMLElement | null>(null)

	readonly slot: OverlaySlot = computed(() => {
		const Overlay = this._store.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) => resolveOverlaySlot(Overlay, option, defaultComponent)
	})

	readonly select = event<{mark: Token; match: OverlayMatch}>()
	readonly close = event()

	#scope?: () => void

	constructor(private readonly _store: Store) {}

	#probeTrigger() {
		const match = TriggerFinder.find(this._store.props.options(), option => option.overlay?.trigger)
		this.match(match)
	}

	enable() {
		if (this.#scope) return

		this.#scope = effectScope(() => {
			watch(this.close, () => {
				this.match(undefined)
			})

			watch(this._store.value.change, () => {
				const showOverlayOn = this._store.props.showOverlayOn()
				const type: OverlayTrigger = 'change'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			})

			effect(() => {
				const match = this.match()
				if (match) {
					this._store.nodes.input.target = this._store.nodes.focus.target

					listen(window, 'keydown', e => {
						if (e.key === KEYBOARD.ESC) {
							this.close()
						}
					})

					listen(
						document,
						'click',
						e => {
							const target = e.target instanceof HTMLElement ? e.target : null
							if (this.element()?.contains(target)) return
							if (this._store.slots.container()?.contains(target)) return
							this.close()
						},
						true
					)
				}
			})

			const selectionChangeHandler = () => {
				const container = this._store.slots.container()
				if (!container?.contains(document.activeElement)) return

				const showOverlayOn = this._store.props.showOverlayOn()
				const type: OverlayTrigger = 'selectionChange'

				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			}

			listen(document, 'selectionchange', selectionChangeHandler)

			watch(this.select, overlayEvent => {
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

				this._store.caret.recovery(
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
					const tokens = this._store.parsing.tokens()
					const inputToken = tokens[this._store.nodes.input.index]
					if (inputToken.type === 'text') {
						inputToken.content = newSpan
					}

					this._store.nodes.focus.target = this._store.nodes.input.target
					this._store.nodes.input.clear()
					onChange?.(toString(tokens))
					this._store.parsing.reparse()
				}
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}
}