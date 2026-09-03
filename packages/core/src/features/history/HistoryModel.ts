import {batch, computed, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import type {PropsModel} from '../state/PropsModel'
import type {EditRecord, TokenModel, Window} from '../tokens'
import {gapWindow, invertWindow} from '../tokens'

/**
 * How long a run stays open. Consecutive one-character edits in the same direction inside this
 * window are ONE entry; a pause longer than it starts a new one, which is what stops a paragraph's
 * worth of typing from being one undo.
 */
const RUN_MS = 500

/**
 * THE EDITOR'S OWN UNDO STACK (ADR-0012). Two lists of {@link EditRecord}s and nothing else: the
 * edits the document has taken, and the ones an undo took back off it.
 *
 * A `*Model` rather than a `*Controller` — it owns state and registers no DOM listener. The keys
 * that reach it are the keyboard feature's (`features/keyboard/input.ts`), for the same reason
 * every other key is: one container, one listener tier.
 *
 * IT REPLAYS RECORDS, IT DOES NOT WRITE VALUES. `TokenModel.replay` bypasses the sink that
 * captures records, so an undo emits none and the stack cannot re-enter itself — there is no
 * "am I replaying" latch, because a replay is not an edit path.
 *
 * AN ENTRY IS ONLY USABLE WHILE THE DOCUMENT STILL HOLDS THE PROJECTION ITS WINDOW LIVES IN, and
 * that one comparison is the whole of the stack's soundness: it is what an out-of-band value —
 * a parent writing the value itself, a transform the editor did not make — trips, and what makes
 * {@link canUndo} honest rather than merely non-empty. It is derived rather than maintained: no
 * flag to clear, no arrival to listen for, and an entry becomes usable again if the document
 * comes back to it.
 */
export class HistoryModel {
	constructor(
		private readonly props: PropsModel,
		private readonly tokens: TokenModel
	) {
		// No `host.onMounted` scope: this subscription is not DOM-bound and edits made before a
		// container attaches are edits (`TokenModel.value.spec`'s pre-mount write). It lives and
		// dies with the store.
		watch(this.tokens.edits, record => this.#push(record))
	}

	/** Is there an entry to undo — and does the document still hold what it would undo? */
	readonly canUndo: Computed<boolean> = computed(() => this.#holds(this.#past().at(-1)?.next))

	/** The mirror image: a redo re-applies its record's own splice, so the document must be its base. */
	readonly canRedo: Computed<boolean> = computed(() => this.#holds(this.#future().at(-1)?.base))

	/**
	 * Take the last edit off the document, restoring the caret it was made from. Answers whether
	 * the replay was ACCEPTED, which in controlled mode is the emission — the same reading every
	 * other controlled verb has.
	 *
	 * THE STACK MOVES ON LANDING, not on the call: a controlled parent may decline the undo, and
	 * an entry consumed on an emission the document never took is stranded in `#future` — where
	 * its own base does not match either, so it is offered by neither side and the next edit
	 * discards it. Deferred, a refused undo leaves the stack exactly as it found it and the user
	 * may press again.
	 */
	undo(): boolean {
		const entry = this.#past().at(-1)
		if (!entry || !this.canUndo()) return false
		return this.tokens.replay(entry.base, invertWindow(entry.window), {
			caret: entry.selectionBefore,
			landed: () => this.#move(entry, this.#past, this.#future),
		})
	}

	/**
	 * Put it back. NO CARET IS NAMED, deliberately: the caret sits where the undo restored it —
	 * the position the edit was made from — so the window arithmetic maps it to exactly the
	 * post-edit position, which is the one a redo wants.
	 */
	redo(): boolean {
		const entry = this.#future().at(-1)
		if (!entry || !this.canRedo()) return false
		return this.tokens.replay(entry.next, entry.window, {
			landed: () => this.#move(entry, this.#future, this.#past),
		})
	}

	/** The edits the document took, oldest first. */
	readonly #past: Signal<readonly EditRecord[]> = signal<readonly EditRecord[]>({default: []})

	/** What an undo took back off it, in the order a redo puts them back. */
	readonly #future: Signal<readonly EditRecord[]> = signal<readonly EditRecord[]>({default: []})

	/**
	 * When the OPEN RUN on top of {@link #past} last grew, or `0` when the top entry is not one —
	 * the only state a coalescing rule cannot derive.
	 *
	 * It has to say "is a run open" as well as "when", because after the first merge the entry no
	 * longer LOOKS like a single keystroke: its window carries `insertedLength: 2`, and a paste is
	 * a pure insertion of many characters too. Reading openness off the window's shape is what made
	 * coalescing pairwise — an eleven-character run came off in six presses — and reading it off
	 * `insertedLength >= 1` alone would swallow the keystroke after a paste into the paste's entry.
	 *
	 * IT IS THE SAME GUARD ON THE DELETE SIDE, and there it is load-bearing rather than merely
	 * useful: a selection delete IS a pure removal of a span, which is exactly what a growing delete
	 * run looks like, so without this the next Backspace would be swallowed into the entry that took
	 * the selection away. Only a ONE-CHARACTER edit opens a run, on either side.
	 */
	#runGrewAt = 0

	/**
	 * `readOnly` rides beside `history` here because {@link TokenModel.replay} refuses under it:
	 * an offer this did not share would be a menu item the user may press to no effect. It
	 * REFUSES rather than forgets — the entries outlive the flip, exactly as they outlive a
	 * value the parent wrote.
	 */
	#holds(projection: string | undefined): boolean {
		if (!this.props.history() || this.props.readOnly()) return false
		return projection !== undefined && projection === this.tokens.value()
	}

	/**
	 * One landed edit. A fresh edit DISCARDS the redo stack — the branch it would have replayed is
	 * not this document's future any more.
	 *
	 * The `history` prop is read here as well as in {@link #holds}, and neither read covers the
	 * other: recording alone would leave an editor that turned history off still undoing what an
	 * earlier `history: true` recorded, and querying alone would grow a stack that editor can
	 * never use.
	 */
	#push(record: EditRecord): void {
		if (!this.props.history()) return
		if (record.repair) return this.#settle(record)
		const past = this.#past()
		const previous = past.at(-1)
		const open = previous && Date.now() - this.#runGrewAt < RUN_MS
		const run = open ? (typedTogether(previous, record) ?? deletedTogether(previous, record)) : undefined
		// `0` is the sentinel and no clock reaches back to it, so the window test above reads it as
		// "no run is open" without a second comparison.
		this.#runGrewAt =
			run !== undefined || isKeystroke(record.window) || isOneCharDelete(record.window) ? Date.now() : 0
		batch(() => {
			this.#past(run ? [...past.slice(0, -1), run] : [...past, record])
			this.#future([])
		})
	}

	/**
	 * THE EDITOR'S OWN WRITE, folded into the projection the document currently stands on rather
	 * than pushed as a step of its own ({@link EditRecord.repair}).
	 *
	 * IT IS NOT A STEP. The caret invariant opens the door because the caret is in the trap, so
	 * undoing the door restores the trap and the invariant opens it again — a step that instantly
	 * takes itself back, and one that cleared the redo stack every time it did. The whole stack
	 * under it died with it: the entry beneath named a projection the door had already moved past,
	 * so `#holds` refused it and every entry below became unreachable. Measured on the showcase:
	 * `/code`, Enter, `ls`, then one undo, and neither key did anything ever again.
	 *
	 * BOTH STACKS, because after an undo both name the value the repair just moved: the top of
	 * `#past` by its `next`, the top of `#future` by its `base`. Amending one and not the other is
	 * what leaves undo working and redo dead.
	 *
	 * THE WINDOW IS RE-DERIVED, and that is a real loss: an identity {@link Window.pairing} does not
	 * survive it, so a repair landing on a MOVE would make that move's undo re-pair its rows by
	 * index. The composition of two splices is not a splice, and a door opened at the document's
	 * end is not adjacent to the edit that provoked it — Enter inside a fence writes its newline in
	 * the body — so there is no exact single window to keep.
	 */
	#settle(record: EditRecord): void {
		const amend = (stack: Signal<readonly EditRecord[]>, end: 'base' | 'next'): void => {
			const entries = stack()
			const entry = entries.at(-1)
			if (!entry || entry[end] !== record.base) return
			const base = end === 'base' ? record.next : entry.base
			const next = end === 'next' ? record.next : entry.next
			stack([...entries.slice(0, -1), {...entry, base, next, window: gapWindow(base, next)}])
		}
		batch(() => {
			amend(this.#past, 'next')
			amend(this.#future, 'base')
		})
	}

	#move(entry: EditRecord, from: Signal<readonly EditRecord[]>, to: Signal<readonly EditRecord[]>): void {
		batch(() => {
			from(from().slice(0, -1))
			to([...to(), entry])
		})
		// A replay ENDS the run: what the user does next continues the document in front of them,
		// not the run that produced the entry underneath.
		this.#runGrewAt = 0
	}
}

/**
 * Two records as ONE entry, or `undefined` when they are not one gesture.
 *
 * A run is recognised from the records rather than declared by the caller: two pure one-character
 * insertions, the second at exactly where the first ended, in a document the first left behind.
 * Every structural verb — a split, a retype, a move, a duplicate — fails at least one of those
 * tests, which is what makes it its own step without a list of verbs to keep in sync. So does a
 * paste, which is one gesture and one entry however many characters it carries.
 *
 * {@link deletedTogether} is the same sentence read backwards; the two cannot both answer, because
 * an insertion window is a point and a deletion window is a span.
 */
function typedTogether(previous: EditRecord, next: EditRecord): EditRecord | undefined {
	if (previous.next !== next.base) return undefined
	if (!isInsertionAtAPoint(previous.window) || !isKeystroke(next.window)) return undefined
	if (next.window.start !== previous.window.start + previous.window.insertedLength) return undefined
	return {
		base: previous.base,
		next: next.next,
		// Both are insertions at the same growing point, so the pair is one insertion of both
		// characters — in the FIRST record's coordinates, which is the space `base` is in.
		window: {
			start: previous.window.start,
			end: previous.window.end,
			insertedLength: previous.window.insertedLength + next.window.insertedLength,
		},
		selectionBefore: previous.selectionBefore,
	}
}

/**
 * A pure insertion at a POINT, of any length — the shape a growing typing run keeps. Whether such
 * a window is a run or a paste is not written on it; `HistoryModel.#runGrewAt` is what answers that.
 */
function isInsertionAtAPoint(window: Window): boolean {
	return window.start === window.end && window.insertedLength >= 1
}

/**
 * A pure one-character insertion: what a key produces, and nothing else. No test for a
 * {@link Window.pairing} beside it — the two verbs that claim one rewrite whole lines, so such a
 * window always replaces a span and never satisfies the insertion test above it.
 */
function isKeystroke(window: Window): boolean {
	return isInsertionAtAPoint(window) && window.insertedLength === 1
}

/**
 * THE DELETE SIDE OF THE SAME RULE, which ADR-0012 cost (f) declared missing and named the shape
 * of: *"a deletion run is a rule of its own if someone wants it"*. Held Backspace is one gesture
 * and was costing one undo per character, so unwinding four presses took four — where the same four
 * characters typed took one.
 *
 * IT IS THE ARITHMETIC AND NOT A DIRECTION FLAG. Both keys grow a span from a fixed side: Backspace
 * takes the character before the run's low edge (`next.end === previous.start`), Delete the one
 * after its high edge, which is the same offset every time (`next.start === previous.start`). One
 * of the two holds or the pair is not a run; both cannot, since that would need a zero-width
 * deletion.
 *
 * NOTHING CARRYING A {@link Window.pairing} REACHES IT, for the reason {@link isKeystroke} states
 * from the other side: the two verbs that claim a pairing rewrite whole lines, so their window is
 * a span with `insertedLength: text.length` and satisfies neither test on the line below.
 *
 * A DELETE AND A KEYSTROKE NEVER JOIN, which is why this is a second function rather than a wider
 * first one: their composition is a REPLACEMENT rather than a splice of one shape, and unwinding a
 * correction wants the deletion and the retyping as separate presses. `isDeletion(previous.window)`
 * is the whole of that rule, and it is load-bearing rather than a shape check that happens to hold:
 * {@link HistoryModel.#runGrewAt} opens on a KEYSTROKE too, so `previous` is routinely a plain
 * insertion by the time this is asked. Without it, `'hello'` typed `x` then Backspaced merges —
 * the FORWARD test reads `next.start === previous.start` off an insertion's point window — into
 * `{base: 'hello', next: 'hello', window: {start: 5, end: 6}}`, an entry naming an offset past the
 * end of its own base, whose undo does nothing and whose keystroke is gone.
 */
function deletedTogether(previous: EditRecord, next: EditRecord): EditRecord | undefined {
	if (previous.next !== next.base) return undefined
	if (!isDeletion(previous.window) || !isOneCharDelete(next.window)) return undefined
	const backward = next.window.end === previous.window.start
	const forward = next.window.start === previous.window.start
	if (!backward && !forward) return undefined
	return {
		base: previous.base,
		next: next.next,
		// One deletion of both characters, in the FIRST record's coordinates — the space `base` is
		// in. Backward the span grows down from the low edge; forward it grows up from the high one.
		window: {
			start: backward ? next.window.start : previous.window.start,
			end: backward ? previous.window.end : previous.window.end + 1,
			insertedLength: 0,
		},
		selectionBefore: previous.selectionBefore,
	}
}

/** A pure removal of a SPAN, of any width — the shape a growing delete run keeps. */
function isDeletion(window: Window): boolean {
	return window.end > window.start && window.insertedLength === 0
}

/** A pure one-character removal: what one Backspace or one Delete produces, and nothing else. */
function isOneCharDelete(window: Window): boolean {
	return isDeletion(window) && window.end - window.start === 1
}