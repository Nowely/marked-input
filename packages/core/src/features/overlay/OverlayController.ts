import {KEYBOARD} from '../../shared/constants'
import {escape} from '../../shared/escape'
import {signal, computed, event, effect, watch, listen} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CoreOption, OverlayMatch, OverlayTrigger, Slot} from '../../shared/types'
import type {DomModel} from '../dom/DomModel'
import type {EditController} from '../edit'
import type {Token} from '../parsing'
import {annotate} from '../parsing'
import type {TokenModel} from '../parsing/TokenModel'
import * as caretDom from '../selection/caretDom'
import type {SelectionController} from '../selection/SelectionController'
import {resolveOverlaySlot} from '../slots'
import type {OverlaySlot} from '../slots'
import type {Lifecycle} from '../state/Lifecycle'
import type {PropsModel} from '../state/PropsModel'
import type {ValueModel} from '../state/ValueModel'
import {TriggerFinder} from './TriggerFinder'

export class OverlayController {
	readonly match = signal<OverlayMatch>()
	readonly element = signal<HTMLElement | null>({initial: null})

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

	constructor(
		private readonly lifecycle: Lifecycle,
		private readonly props: PropsModel,
		private readonly value: ValueModel,
		private readonly dom: DomModel,
		private readonly selection: SelectionController,
		private readonly edit: EditController,
		private readonly tokens: TokenModel
	) {
		const hasOverlayTrigger = computed(() => this.props.options().some(opt => opt.overlay?.trigger != null))

		this.lifecycle.onMounted(() => {
			watch(this.close, () => {
				if (!hasOverlayTrigger()) return
				this.match(undefined)
			})

			watch(this.value.current, () => {
				if (!hasOverlayTrigger()) return
				const showOverlayOn = this.props.showOverlayOn()
				const type: OverlayTrigger = 'change'
				if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
					this.#probeTrigger()
				}
			})

			effect(() => {
				const match = this.match()
				if (!match) return
				listen(window, 'keydown', e => {
					if (e.key === KEYBOARD.ESC) this.close()
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
			})

			effect(() => {
				if (!hasOverlayTrigger()) return
				const handler = () => {
					const container = this.dom.container()
					if (!container?.contains(document.activeElement)) return
					const showOverlayOn = this.props.showOverlayOn()
					const type: OverlayTrigger = 'selectionChange'
					if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
						this.#probeTrigger()
					}
				}
				listen(document, 'selectionchange', handler)
			})

			watch(this.select, overlayEvent => {
				if (!hasOverlayTrigger()) return
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

				this.edit.replace(range, annotation)
				this.match(undefined)
			})
		})
	}

	#probeTrigger() {
		const match =
			TriggerFinder.find(this.props.options(), option => option.overlay?.trigger, this.dom) ??
			this.#probeTriggerFromCaretRange()
		this.match(match)
	}

	#probeTriggerFromCaretRange(): OverlayMatch | undefined {
		const sel = this.selection.range()
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