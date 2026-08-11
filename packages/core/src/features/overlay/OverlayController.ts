import {KEYBOARD} from '../../shared/constants'
import {escape} from '../../shared/escape'
import {signal, computed, event, effect, watch, listen} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CoreOption, OverlayMatch, OverlayTrigger, Slot} from '../../shared/types'
import type {EditController} from '../edit'
import type {OverlaySlot} from '../slots'
import {resolveOverlaySlot} from '../slots/resolveSlot'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {TokenModel} from '../tokens'
import {anchorEquals, annotate} from '../tokens'
import {TriggerFinder} from './TriggerFinder'

export class OverlayController {
	readonly match = signal<OverlayMatch>()
	readonly element = signal<HTMLElement | null>({initial: null})

	readonly slot: OverlaySlot = computed(() => {
		const Overlay = this.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) => resolveOverlaySlot(Overlay, option, defaultComponent)
	})

	readonly close = event()

	readonly position: Computed<{left: number; top: number}> = computed(() => {
		if (!this.match()) return {left: 0, top: 0}
		const rect = this.tokens.domSelection()?.rect
		if (!rect) return {left: 0, top: 0}
		return {left: rect.left, top: rect.top + rect.height + 1}
	})

	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly edit: EditController,
		private readonly tokens: TokenModel
	) {
		const hasOverlayTrigger = computed(() => this.props.options().some(opt => opt.overlay?.trigger != null))

		this.host.onMounted(() => {
			watch(this.close, () => {
				if (!hasOverlayTrigger()) return
				this.match(undefined)
			})

			watch(this.tokens.value, () => {
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
						if (this.host.container()?.contains(target)) return
						this.close()
					},
					true
				)
			})

			effect(() => {
				if (!hasOverlayTrigger()) return
				const handler = () => {
					const container = this.host.container()
					if (!container?.contains(document.activeElement)) return
					const showOverlayOn = this.props.showOverlayOn()
					const type: OverlayTrigger = 'selectionChange'
					if (showOverlayOn === type || (Array.isArray(showOverlayOn) && showOverlayOn.includes(type))) {
						this.#probeTrigger()
					}
				}
				listen(document, 'selectionchange', handler)
			})
		})
	}

	/** Commit the active overlay match as an annotation of (value, meta), then close. */
	choose(value: string, meta?: string): void {
		// No hasOverlayTrigger guard needed: match is only ever set by #probeTrigger,
		// which requires a trigger option, so a missing trigger means match() is undefined.
		const match = this.match()
		if (!match) return
		const markup = match.option.markup
		if (!markup) return
		this.edit.replace(match.range.anchor, match.range.head, annotate(markup, {value, meta}))
		this.match(undefined)
	}

	#probeTrigger() {
		const match =
			TriggerFinder.find(this.props.options(), option => option.overlay?.trigger, this.tokens) ??
			this.#probeTriggerFromCaretRange()
		this.match(match)
	}

	/**
	 * The model-side probe, for when `TriggerFinder` cannot read the DOM (no window selection,
	 * or an anchor node outside the document). It slices the caret NODE's own text at the
	 * caret's LOCAL offset, where it used to slice `value()` at an absolute cursor.
	 *
	 * Equivalent wherever it fired before: the regex is anchored at the caret, so it only ever
	 * looked at characters immediately left of it, and those are in the caret's own node
	 * unless the caret sits at its start — where the whole-value read saw a preceding mark's
	 * markup, which ends in `]` or `)` and matches no `trigger(\w*)$`. What DID change is
	 * `span`, now the node's text rather than the whole value; that makes it agree with
	 * `TriggerFinder.span`, which was always the DOM text node's content.
	 */
	#probeTriggerFromCaretRange(): OverlayMatch | undefined {
		const anchors = this.tokens.selection.anchors()
		if (!anchors || !anchorEquals(anchors.anchor, anchors.head)) return
		const caret = anchors.anchor
		// A mark boundary or a document edge has no text to probe; only a text anchor does.
		if (typeof caret === 'string' || !('node' in caret)) return

		const text = caret.node.text()
		const left = text.slice(0, caret.offset)
		const right = text.slice(caret.offset)
		const rightWord = right.match(/^\w*/)?.[0] ?? ''

		for (const option of this.props.options()) {
			const trigger = option.overlay?.trigger
			if (!trigger) continue

			const match = left.match(new RegExp(`${escape(trigger)}(\\w*)$`))
			if (!match) continue

			const [sourceLeft, wordLeft] = match
			return {
				value: wordLeft + rightWord,
				source: sourceLeft + rightWord,
				range: {
					anchor: {node: caret.node, offset: caret.offset - sourceLeft.length},
					head: {node: caret.node, offset: caret.offset + rightWord.length},
				},
				span: text,
				node: this.tokens.domSelection()?.anchor.node ?? this.host.container() ?? document.body,
				option,
			}
		}
	}
}