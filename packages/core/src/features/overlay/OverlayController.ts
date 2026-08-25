import {KEYBOARD} from '../../shared/constants'
import {escape} from '../../shared/escape'
import {reportBadProp} from '../../shared/reportBadProp'
import {signal, computed, event, effect, watch, listen} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {CoreOption, MenuEntry, OverlayMatch, OverlayPick, Slot} from '../../shared/types'
import type {EditController} from '../edit'
import type {OverlaySlot} from '../slots'
import {resolveOverlaySlot} from '../slots/resolveSlot'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {RowNode, TokenModel} from '../tokens'
import {anchorEquals, annotate, markupError} from '../tokens'
import {filterSuggestions} from './filterSuggestions'
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
	 * THE DOCUMENTED ALIAS of {@link choose}'s value arm, and the older of the two spellings —
	 * every overlay example in the docs calls it, which is why it stays. `choose` is canonical:
	 * it takes either arm of an {@link OverlayPick} and says whether it wrote. An arrow so the
	 * adapters can pass it around unbound.
	 */
	readonly select = (value: {value: string; meta?: string}): void => {
		this.choose(value)
	}

	readonly slot: OverlaySlot = computed(() => {
		const Overlay = this.props.Overlay()
		return (option?: CoreOption, defaultComponent?: Slot) => resolveOverlaySlot(Overlay, option, defaultComponent)
	})

	readonly close = event()

	/**
	 * THE ROW MENU, assembled from the options themselves: every option carrying a {@link MenuSpec}
	 * contributes exactly one entry, filtered by what the user typed after the trigger. There is no
	 * registry and no second list — an option that declares an entry IS in the menu, which is what
	 * lets a consumer's menu component be pure paint.
	 *
	 * The query pass IS {@link filterSuggestions}, over the label and the entry's own hidden
	 * keywords: one rule for "does this row match what was typed", shared with the built-in
	 * suggestion list rather than written twice.
	 */
	readonly entries: Computed<readonly MenuEntry[]> = computed(() => {
		const match = this.match()
		if (!match) return []
		return this.props.options().flatMap(option => {
			const menu = option.menu
			if (!menu) return []
			const haystack = [menu.label, ...(menu.keywords ?? [])]
			if (filterSuggestions(haystack, match.value).length === 0) return []
			return [{option, label: menu.label}]
		})
	})

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
					// AN OPEN MATCH IS RE-PROBED WHENEVER THE CARET MOVES, whatever `showOverlayOn`
					// says. That prop decides when an overlay OPENS; whether one already open still
					// belongs to the caret is a different question, and nothing was asking it. At
					// the default `'change'` a click into another row left the menu standing — the
					// outside-click listener returns early for any click INSIDE the container — and
					// the next pick retyped the row the user had LEFT: caret in `gamma`, pointer on
					// Heading 2, value `'## alpha⏎beta⏎gamma'`. An arrow key with the menu open did
					// the same thing more quietly, moving the document caret under an open popup.
					//
					// It cannot OPEN anything: the arm runs only while a match already stands, and
					// `#probeTrigger` writes whatever the caret's own text answers — the same match
					// while the caret is still on its trigger, and `undefined` once it is not.
					if (this.#wantsTrigger('selectionChange') || this.match()) this.#probeTrigger()
				}
				listen(document, 'selectionchange', handler)
			})
		})
	}

	/**
	 * Commit the active overlay match as an annotation of (value, meta), then close.
	 *
	 * THIS IS WHERE AN UNUSABLE MARKUP IS REFUSED, and it is the only place it can be. The probe
	 * below scans `props.options()` RAW and opens for any option carrying a `trigger`, which is
	 * deliberate: an option with NO `markup` is a shipping configuration whose overlay must still
	 * appear (`Overlay.stories.ts`'s DefaultOverlay and CustomTrigger are both one), so "opens the
	 * overlay" cannot be gated on a usable markup without splitting the two shapes
	 * `CoreOption.markup` documents as equivalent. The insertion is the only step a broken markup
	 * actually breaks, so the insertion is what declines.
	 *
	 * IT ASKS `markupError` ITSELF rather than trusting the props boundary to have asked.
	 * `TokenModel.#parser` short-circuits on `#hasMark()`, so an editor with a trigger option and
	 * no `Mark` component never validates any markup at all — and would then annotate with one
	 * `Parser` rejects, writing text nothing reads back as a mark straight into the document.
	 * Reported for the same reason, and at the moment the consumer's user actually loses a
	 * selection rather than at a mount they may never have watched.
	 *
	 * A PICK rather than two positional strings: it is the one accept path, and what a pick names
	 * is what gets written. `false` says nothing was — the overlay stays open on a refusal, so the
	 * user still has the selection they made.
	 *
	 * AN `option` NAMES A ROW KIND and takes the other arm entirely: the trigger span leaves the
	 * caret's row and that row takes the kind, in ONE splice, because two verbs cannot compose in
	 * controlled mode — the tree has not moved when the first returns. That is `turnInto(option,
	 * {text})`, and it is why the verb takes the body text at all. On a row holding nothing but
	 * the trigger the entry's own `menu.text`/`menu.meta` seed the empty body; on a row that
	 * already has text the body is kept, because a turn-into must not discard what was typed.
	 *
	 * The two arms are a UNION, so an option arm carries no `value`/`meta` for `turnInto` to
	 * ignore and a value arm carries no `option`. See {@link OverlayPick}.
	 *
	 * An arrow for {@link select}'s reason: both adapters hand it straight to a menu component,
	 * unbound.
	 */
	readonly choose = (pick: OverlayPick): boolean => {
		// No hasOverlayTrigger guard needed: match is only ever set by #probeTrigger,
		// which requires a trigger option, so a missing trigger means match() is undefined.
		const match = this.match()
		if (!match) return false
		// `!== undefined`, not `'option' in pick`: the arms discriminate on `?: never`, which is an
		// OPTIONAL key on both, so `in` narrows nothing.
		if (pick.option !== undefined) {
			if (!this.#turnRowInto(pick.option)) return false
			this.match(undefined)
			return true
		}
		const markup = match.option.markup
		// An overlay-only option, and silent by contract: omitting `markup` is how it is spelled.
		if (markup === undefined) return false
		const invalid = markupError(markup)
		if (invalid !== undefined) {
			reportBadProp(`${invalid}. The overlay selection was discarded — this option can insert nothing.`)
			return false
		}
		this.edit.replace(match.range.anchor, match.range.head, annotate(markup, {value: pick.value, meta: pick.meta}))
		this.match(undefined)
		return true
	}

	/**
	 * THE ROW THE OPEN OVERLAY ACTS ON, with the trigger already taken out of its body. An EMPTY
	 * body is the insert gesture and a non-empty one is turn-into, decided at this one read.
	 *
	 * `undefined` for no open overlay, for a caret in no row (a document that parses none), and
	 * for a span the row's body does not contain, which {@link slotWithout} refuses.
	 */
	#target(): {row: RowNode; body: string} | undefined {
		const match = this.match()
		if (!match) return undefined
		const row = this.tokens.rowOf(match.range.anchor)?.row
		if (!row) return undefined
		const body = this.tokens.slotWithout(row, match.range)
		// TYPE-FORCED, not behaviour-forced, and measured: throwing here reddens nothing, because
		// `row` is derived from the SAME anchor the span was built around, so this caller cannot
		// hand `slotWithout` a span outside that row. The refusal is real and pinned where it is
		// reachable — `anchors.spec.ts` calls `slotWithout` directly with a foreign span.
		if (body === undefined) return undefined
		return {row, body}
	}

	/** {@link choose}'s option arm. `false` when there is no row to retype, or the verb refuses. */
	#turnRowInto(option: CoreOption): boolean {
		const target = this.#target()
		if (!target) return false
		const menu = option.menu
		return target.row.turnInto(option, {
			// An EMPTY body is the insert gesture: the row held nothing but the trigger, so there is
			// nothing to keep and the entry's own seed writes it.
			text: target.body === '' ? (menu?.text ?? '') : target.body,
			meta: menu?.meta,
		})
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
	 *
	 * LEFT OF THE CARET AND NOTHING ELSE, which is also the whole of what `match.value` promises
	 * ("typed text after trigger"). The span used to be stretched over the word to the RIGHT as
	 * well, on the theory that a trigger typed into an existing word means to complete it — but
	 * the query is what the user TYPED, and the pick cuts the whole span out: opening the menu at
	 * the start of `'Quote of the day'` filtered on `Quote`, and choosing emitted `'>  of the
	 * day'`. Nothing right of the caret is the user's answer to a menu they have not seen yet.
	 */
	#findTrigger(): OverlayMatch | undefined {
		const anchors = this.tokens.selection.anchors()
		if (!anchors || !anchorEquals(anchors.anchor, anchors.head)) return
		const caret = anchors.anchor
		// A mark boundary or a document edge has no text to probe; only a text anchor does.
		if (typeof caret === 'string' || !('node' in caret)) return

		const text = caret.node.text()
		const left = text.slice(0, caret.offset)

		for (const option of this.props.options()) {
			const trigger = option.overlay?.trigger
			if (!trigger) continue

			const match = left.match(new RegExp(`${escape(trigger)}(\\w*)$`))
			if (!match) continue

			const [source, value] = match
			return {
				value,
				source,
				range: {
					anchor: {node: caret.node, offset: caret.offset - source.length},
					head: {node: caret.node, offset: caret.offset},
				},
				span: text,
				node: this.tokens.handle(caret.node.id)?.element() ?? this.host.container() ?? document.body,
				option,
			}
		}
	}
}