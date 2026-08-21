import {KEYBOARD} from '../../shared/constants'
import {escape} from '../../shared/escape'
import {signal, computed, event, effect, watch, listen} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CoreOption, OverlayMatch, Slot} from '../../shared/types'
import type {EditController} from '../edit'
import type {OverlaySlot} from '../slots'
import {resolveOverlaySlot} from '../slots/resolveSlot'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {TokenModel} from '../tokens'
import {anchorEquals, annotate} from '../tokens'
import {SuggestionsModel} from './SuggestionsModel'

export class OverlayController {
	/**
	 * THE open overlay, or `undefined`. Compared BY CONTENT, because `#findTrigger` allocates a
	 * fresh match on every probe and every commit re-probes. Without this, a commit that changes
	 * nothing the overlay can see — a parent re-setting `value` to what it already holds, a
	 * reparse — announced a "new" match, and `SuggestionsModel`'s watch reset the highlighted
	 * suggestion to NaN. The user lost the row they had arrowed to, for a probe that found
	 * exactly the same thing. Measured field by field: value, source, span, node, option and
	 * both anchors were all identical, including the anchors' own node objects.
	 *
	 * `range` needs {@link anchorEquals} for `selection.ts`'s reason — one position has two legal
	 * spellings — and everything else is identity, which is what a re-probe preserves.
	 */
	readonly match = signal<OverlayMatch>({
		equals: (a, b) =>
			a === b ||
			(a !== undefined &&
				b !== undefined &&
				a.value === b.value &&
				a.source === b.source &&
				a.span === b.span &&
				a.node === b.node &&
				a.option === b.option &&
				anchorEquals(a.range.anchor, b.range.anchor) &&
				anchorEquals(a.range.head, b.range.head)),
	})
	readonly element = signal<HTMLElement | null>({initial: null})

	/** The `{current}` facade over `element` that both adapters hand out as `OverlayHandler.ref`. */
	readonly ref: {current: HTMLElement | null}

	readonly suggestions: SuggestionsModel

	/**
	 * `choose` under the `{value, meta}` payload shape both adapters expose as
	 * `OverlayHandler.select`. An arrow so the adapters can pass it around unbound.
	 */
	readonly select = (value: {value: string; meta?: string}): void => {
		this.choose(value.value, value.meta)
	}

	readonly slot: OverlaySlot = computed(() => {
		const Overlay = this.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) => resolveOverlaySlot(Overlay, option, defaultComponent)
	})

	readonly close = event()

	readonly position: Computed<{left: number; top: number}> = computed(() => {
		if (!this.match()) return {left: 0, top: 0}
		const rect = this.tokens.caretRect()
		if (!rect) return {left: 0, top: 0}
		return {left: rect.left, top: rect.top + rect.height + 1}
	})

	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly edit: EditController,
		private readonly tokens: TokenModel
	) {
		this.suggestions = new SuggestionsModel(host, this)

		const element = this.element
		this.ref = {
			get current() {
				return element()
			},
			set current(v: HTMLElement | null) {
				element(v)
			},
		}

		const hasOverlayTrigger = computed(() => this.props.options().some(opt => opt.overlay?.trigger != null))

		this.host.onMounted(() => {
			watch(this.close, () => {
				if (!hasOverlayTrigger()) return
				this.match(undefined)
			})

			// `tokens.committed`, NOT `tokens.value` — the same post-commit clock the
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
				if (this.#wantsTrigger('change')) this.#probeTrigger()
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
					if (this.#wantsTrigger('selectionChange')) this.#probeTrigger()
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

	#wantsTrigger(type: 'change' | 'selectionChange'): boolean {
		const on = this.props.showOverlayOn()
		return on === type || (Array.isArray(on) && on.includes(type))
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