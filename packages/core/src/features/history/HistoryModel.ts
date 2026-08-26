import {batch, computed, signal, watch} from '../../shared/signals'
import type {Computed, Signal} from '../../shared/signals'
import type {PropsModel} from '../state/PropsModel'
import type {EditRecord, TokenModel, Window} from '../tokens'
import {gapWindow, invertWindow} from '../tokens'

/**
 * How long a typing run stays open. Consecutive characters typed forward inside this window are
 * ONE entry; a pause longer than it starts a new one, which is what stops a paragraph's worth of
 * typing from being one undo.
 */
const TYPING_RUN_MS = 500

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
	 * When the OPEN TYPING RUN on top of {@link #past} last grew, or `0` when the top entry is not
	 * one — the only state a coalescing rule cannot derive.
	 *
	 * It has to say "is a run open" as well as "when", because after the first merge the entry no
	 * longer LOOKS like a keystroke: its window carries `insertedLength: 2`, and a paste is a pure
	 * insertion of many characters too. Reading openness off the window's shape is what made
	 * coalescing pairwise — an eleven-character run came off in six presses — and reading it off
	 * `insertedLength >= 1` alone would swallow the keystroke after a paste into the paste's entry.
	 */
	#typedAt = 0

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
		const run = previous && Date.now() - this.#typedAt < TYPING_RUN_MS ? typedTogether(previous, record) : undefined
		// `0` is the sentinel and no clock reaches back to it, so the window test above reads it as
		// "no run is open" without a second comparison.
		this.#typedAt = run !== undefined || isKeystroke(record.window) ? Date.now() : 0
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
		// A replay ENDS the typing run: what the user types next continues the document in front
		// of them, not the run that produced the entry underneath.
		this.#typedAt = 0
	}
}

/**
 * Two records as ONE entry, or `undefined` when they are not one gesture.
 *
 * A typing run is the only thing that coalesces, and it is recognised from the records rather
 * than declared by the caller: two pure one-character insertions, the second at exactly where the
 * first ended, in a document the first left behind. Every structural verb — a split, a retype, a
 * move, a duplicate — fails at least one of those tests, which is what makes it its own step
 * without a list of verbs to keep in sync. So does a paste, which is one gesture and one entry
 * however many characters it carries.
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
 * a window is a run or a paste is not written on it; `HistoryModel.#typedAt` is what answers that.
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