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

			// `tokens.changed`, NOT `tokens.value` — the same post-commit clock the
			// `selectionChange` arm below already probes on. In controlled mode `value` is
			// `props.value()` and `??` short-circuits, so this watch was notified by the parent's
			// echo DIRECTLY: it ran from inside adoption, before the surfaces were written and
			// before the caret repair, and matched the trigger against the previous generation's
			// caret. `changed` is announced once the commit is complete, which is what makes the
			// caret and the tree agree.
			//
			// It fires per COMMIT where `value` fired per string change, and that is a superset,
			// not a trade — measured on all three cases where they could differ. A controlled
			// edit the parent never echoes: 0 and 0 (`value` IS `props.value` there, so it was
			// already silent). A parent that transforms the value back to what it already was:
			// 0 and 0 (the props signal short-circuits the equal write). An uncontrolled commit
			// that leaves the string unchanged: 0 and 1 — the one case `changed` adds, and a
			// probe is idempotent.
			watch(this.tokens.committed, () => {
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
		this.match(this.#findTrigger())
	}

	/**
	 * THE probe, and it is MODEL-ONLY: the stored caret anchor plus that node's own `text()`.
	 * It replaced a `TriggerFinder` that read `tokens.domSelection()?.anchor` (the browser
	 * caret) and `anchor.node.textContent` (the raw surface) and fell back to this, and the
	 * mixture is what the stale-probe bug was made of — a match assembled from one
	 * generation's DOM and another's anchors is representable in that shape and is not in
	 * this one. The DOM the answer still names is resolved THROUGH the matched node's own
	 * handle, so it cannot disagree with the text that produced the match.
	 *
	 * It slices the caret NODE's text at the caret's LOCAL offset. The regex is anchored at
	 * the caret, so it only ever looks at characters immediately left of it, and those are in
	 * the caret's own node unless the caret sits at its start — where a whole-value read would
	 * see a preceding mark's markup, which ends in `]` or `)` and matches no `trigger(\w*)$`.
	 */
	#findTrigger(): OverlayMatch | undefined {
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
				node: this.tokens.handle(caret.node.id)?.element() ?? this.host.container() ?? document.body,
				option,
			}
		}
	}
}