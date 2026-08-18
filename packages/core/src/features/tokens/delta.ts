/**
 * The `changed` payload (spec §2.3) — the three id lists one commit did to the id space.
 *
 * Granularity is NORMATIVE and differs per field:
 *
 * - `added` / `removed` — SUBTREE-INCLUSIVE: a born or dead mark contributes every
 *   descendant id. That is not maintained, it is structural — both are differences against
 *   the FLATTENED tree, and a flattened set has no roots-only spelling to get wrong. The
 *   accumulator this replaced had to walk `TransactionResult`'s subtree roots to reach the
 *   same place, and roots-only `added` folded against subtree-inclusive `removed` would have
 *   announced descendant removals for ids the consumer was never told existed.
 * - `updated` — PER NODE, no subtree claim: an id is listed iff that node's own
 *   content/props changed. Adoption's `updated` feed lowers straight through, so a mark whose
 *   PROJECTION changed while its own fields did not stays out; a consumer needing the subtree
 *   re-reads the tree.
 *
 * ORDER is unspecified: `added` follows the tree's depth-first flatten, `removed` the
 * previously announced set's iteration order. No consumer may depend on it.
 */
export type TokenDelta = {
	readonly added: readonly number[]
	readonly removed: readonly number[]
	readonly updated: readonly number[]
}

function difference(from: ReadonlySet<number>, minus: ReadonlySet<number>): number[] {
	const out: number[] = []
	for (const id of from) {
		if (!minus.has(id)) out.push(id)
	}
	return out
}

/**
 * THE id-space bookkeeping of one commit pipeline, and the whole of it. Two members, no DOM
 * and no tree: it speaks ids and nothing else, so the announcement algebra is exercisable
 * without a browser, a bind or an adoption result.
 *
 * That isolation is the point rather than a side effect. The announcement is DERIVED, not
 * maintained — the accumulator it replaced merged three `Set`s per apply and cancelled by
 * exact id — and the two cancellation rules it used to spell out now fall out of the
 * arithmetic: a node born and killed inside one window entered neither set, so it appears in
 * neither list; an update to a node that then died is dropped by `∩ ids`. With every
 * announcement re-diffed against truth, "the ledger lost or mis-merged an id" stops being
 * expressible and a dropped announcement is self-healing.
 *
 * The one rule that is NOT arithmetic and has to be written down is `∩ announced` on
 * `updated`: it is what keeps a freshly added node out of `added` and `updated` at once. Its
 * predecessor spelled the same rule as `if (!into.added.has(id))`. Mutation testing found it
 * covered by NO test in either version, which is a large part of why this is a module with a
 * spec of its own rather than three closures inside `commit.ts`.
 */
export type DeltaLedger = {
	/** Record that a node's own content changed. Accumulates until the next announcement. */
	touch(id: number): void
	/**
	 * The three lists against `ids` — the CURRENT id space, flattened. Adopts `ids` as the
	 * announced space and drains the touched set, so the next call diffs against this one.
	 *
	 * Takes ownership of `ids`: the caller must not mutate it afterwards. `bind` builds a
	 * fresh Set per walk, which is the only production caller.
	 */
	announce(ids: Set<number>): TokenDelta
	/**
	 * The same announcement for a commit that PROVABLY did not move the id space, which needs
	 * no set to diff against: `added` and `removed` are empty by construction and `updated` is
	 * the touched ids that are still announced.
	 *
	 * A verb rather than "call `announce` with the current ids" because the caller does not
	 * hold them — and should not: the whole reason the text path is cheap is that it never
	 * walks the tree to find out. Its precondition is checkable at the call site: `render` is
	 * `structural || …` and `structural` is `added.length > 0 || removed.length > 0`
	 * (`tree/adopt.ts`), so a commit that routed to the text path added and removed nothing.
	 */
	announceUnchanged(): TokenDelta
}

export function createDeltaLedger(): DeltaLedger {
	/**
	 * THE id space the consumer was last told about. REPLACED wholesale by each announcement
	 * rather than mutated in place, so it is always exactly one announcement behind.
	 */
	let announced = new Set<number>()
	/** Ids whose OWN content changed since the last announcement. */
	const touched = new Set<number>()

	/**
	 * `touched ∩ ids ∩ announced` — the touched ids that are still alive AND were already
	 * known. The `∩ announced` half is the rule that keeps a freshly added node out of `added`
	 * and `updated` at once; see the note on {@link DeltaLedger}.
	 */
	function stillAnnounced(ids: ReadonlySet<number>): number[] {
		const out: number[] = []
		for (const id of touched) {
			if (ids.has(id) && announced.has(id)) out.push(id)
		}
		return out
	}

	return {
		touch(id) {
			touched.add(id)
		},
		announce(ids) {
			const delta: TokenDelta = {
				added: difference(ids, announced),
				removed: difference(announced, ids),
				updated: stillAnnounced(ids),
			}
			announced = ids
			touched.clear()
			return delta
		},
		announceUnchanged() {
			const delta: TokenDelta = {added: [], removed: [], updated: stillAnnounced(announced)}
			touched.clear()
			return delta
		},
	}
}