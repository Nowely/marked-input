import type {Parser} from '../parser/Parser'
import {gapWindow} from './gapWindow'
import {createUncontrolledSink} from './transactions'
import type {TokenTree} from './tree'
import type {CommitSink, TransactionResult} from './types'

/** The string boundary (spec §4.4): commit policy plus arrival routing. */
export interface Boundary {
	/** Hand to createTransactions. Adopts (uncontrolled) or emits (controlled). */
	readonly sink: CommitSink
	/** An external value arrived (props.value, defaultValue). Routes into adoption. */
	arrive(value: string): void
	/** Parser or layout changed: re-derive every token from the unchanged projection. */
	reparse(): void
	/** The committed projection. */
	value(): string
}

export function createBoundary(deps: {
	tree: TokenTree
	parser: () => Parser | undefined
	/**
	 * Commit policy (spec D6): uncontrolled adopts the edit at once, controlled emits it and
	 * waits for the parent's echo. Only the uncontrolled branch exists so far.
	 */
	controlled: () => boolean
	onChange: (value: string) => void
	/** The `TransactionResult` feed (spec D9); its pipeline consumer arrives with S1.5. */
	onResult?: (result: TransactionResult) => void
}): Boundary {
	/**
	 * Parse-and-adopt, shared by every path here — an edit commit, an arrival, a reparse.
	 * The uncontrolled sink already IS that operation, parser-less fallback included, so it
	 * is reused rather than restated; the boundary adds only the policy around it.
	 */
	const fold = createUncontrolledSink({tree: deps.tree, parser: deps.parser, onResult: deps.onResult})

	const sink: CommitSink = {
		commit(next, window) {
			// Emission follows adoption: `CommitSink.commit` runs with the tree still holding the
			// pre-edit base, so an `onChange` consumer that reads the tree — the live pipeline
			// does — must not be called before the commit lands.
			const accepted = fold.commit(next, window)
			deps.onChange(next)
			return accepted
		},
	}

	return {
		sink,

		arrive(value) {
			// Gap-derived, so an unchanged value is an inert no-op adoption. The echo of a local
			// edit can instead be adopted through its exact recorded window; that record lands
			// with the controlled sink.
			fold.commit(value, gapWindow(deps.tree.value(), value))
		},

		reparse() {
			// Parser-only, and no emission: the value does not change, only its tokenization.
			// `gapWindow(v, v)` is enough, because adoption is equality-driven rather than
			// window-driven — with the value unchanged both walks go inert and the middle
			// re-derives every token from the new parse. A full window would be worse: it sends
			// every mapped interior offset to the document end.
			//
			// `isBlock` arrivals and `TokenModel#reparse`'s `filterEmptyText` are deliberately
			// out of scope here — block wiring belongs to the props layer, and the tree core
			// applies no empty-text filter anywhere yet.
			const value = deps.tree.value()
			fold.commit(value, gapWindow(value, value))
		},

		/** A public read, deliberately tracked: a consumer may legitimately subscribe to it. */
		value: () => deps.tree.value(),
	}
}