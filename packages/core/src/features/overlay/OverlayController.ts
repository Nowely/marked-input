import {KEYBOARD} from '../../shared/constants'
import {escape} from '../../shared/escape'
import {signal, computed, event, effectScope, effect, watch, listen} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CoreOption, OverlayMatch, OverlayTrigger, Slot} from '../../shared/types'
import {TriggerFinder} from '../caret'
import * as caretDom from '../caret/caretDom'
import type {CaretModel} from '../caret/CaretModel'
import type {DomController} from '../dom/DomController'
import type {Lifecycle} from '../lifecycle/Lifecycle'
import type {Token} from '../parsing'
import {annotate} from '../parsing'
import type {ParseController} from '../parsing/ParseController'
import type {PropsModel} from '../props/PropsModel'
import {resolveOverlaySlot} from '../slots'
import type {OverlaySlot} from '../slots'
import type {ValueModel} from '../value/ValueModel'

export class OverlayController {
	readonly match = signal<OverlayMatch>(undefined)
	readonly element = signal<HTMLElement | null>(null)

	readonly slot: OverlaySlot = computed(() => {
		const Overlay = this.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) => resolveOverlaySlot(Overlay, option, defaultComponent)
	})

	readonly select = event<{mark: Token; match: OverlayMatch}>()
	readonly close = event()

	readonly position: Computed<{left: number; top: number}> = computed(() => {
		if (!this.match()) return {left: 0, top: 0}
		const rect = caretDom.getRect()
		if (!rect) return {left: 0, top: 0}
		return {left: rect.left, top: rect.top + rect.height + 1}
	})

	#scope?: () => void

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly dom: DomController,
		private readonly caret: CaretModel,
		private readonly parsing: ParseController
	) {
		const hasOverlayTrigger = computed(() => this.props.options().some(opt => opt.overlay?.trigger != null))

		const toggle = (enabled: boolean) => {
			if (enabled && !this.#scope) {
				this.#scope = effectScope(() => {
					watch(this.close, () => {
						this.match(undefined)
					})

					watch(this.value.current, () => {
						const showOverlayOn = this.props.showOverlayOn()
						const type: OverlayTrigger = 'change'

						if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
							this.#probeTrigger()
						}
					})

					effect(() => {
						const match = this.match()
						if (match) {
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
									if (this.dom.container()?.contains(target)) return
									this.close()
								},
								true
							)
						}
					})

					const selectionChangeHandler = () => {
						const container = this.dom.container()
						if (!container?.contains(document.activeElement)) return

						const showOverlayOn = this.props.showOverlayOn()
						const type: OverlayTrigger = 'selectionChange'

						if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
							this.#probeTrigger()
						}
					}

					listen(document, 'selectionchange', selectionChangeHandler)

					watch(this.select, overlayEvent => {
						const {
							mark,
							match: {option, range},
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

						const pos = range.start + annotation.length
						this.caret.position(pos)
						this.value.replace(range, annotation)
						this.match(undefined)
					})
				})
			}
			if (!enabled && this.#scope) {
				this.#scope()
				this.#scope = undefined
			}
		}

		this.lifecycle.onMounted(() => {
			watch(hasOverlayTrigger, toggle)
			toggle(hasOverlayTrigger())
		})
	}

	#probeTrigger() {
		const match =
			TriggerFinder.find(this.props.options(), option => option.overlay?.trigger, this.dom) ??
			this.#probeTriggerFromCaretRange()
		this.match(match)
	}

	#probeTriggerFromCaretRange(): OverlayMatch | undefined {
		const sel = this.caret.selection()
		if (!sel || sel.start !== sel.end) return

		const cursor = sel.start
		const value = this.value.current()
		const left = value.slice(0, cursor)
		const right = value.slice(cursor)
		const rightWord = right.match(/^\w*/)?.[0] ?? ''

		for (const option of this.props.options()) {
			const trigger = option.overlay?.trigger
			if (!trigger) continue

			const match = left.match(new RegExp(`${escape(trigger)}(\\w*)$`))
			if (!match) continue

			const [sourceLeft, wordLeft] = match
			const source = sourceLeft + rightWord
			const start = cursor - sourceLeft.length
			return {
				value: wordLeft + rightWord,
				source,
				range: {start, end: start + source.length},
				span: value,
				node: window.getSelection()?.anchorNode ?? this.dom.container() ?? document.body,
				option,
			}
		}
	}
}