import type {MarkToken, Token} from './parser/types'
import {findGap} from './preparsing'

export type EditHint = {
	/** Replaced range in the PREVIOUS value. */
	readonly start: number
	readonly end: number
	readonly insertedLength: number
}

/**
 * Delta buckets carry token ids. `added`/`removed` include the ids of all
 * descendants of the affected tokens. `updated` holds renderer-irrelevant
 * changes: position-only shifts (descendants included) and deep-descended
 * container marks (slot interior changed; descriptor, value/meta and child
 * structure unchanged — spec §Deep reconcile). A descended mark enters
 * `updated` alone: its children report their own changes. `textChanged`
 * holds text tokens whose content changed, plus marks whose descend was
 * REFUSED (value/meta/outside-slot/child-structure changed): those keep
 * mark-level granularity with the id inherited — the subtree is dirty, not
 * diffed — and the commit pipeline escalates them structurally at runtime.
 * DELIBERATE deviation from the consolidation plan's "textChanged ⊆ text
 * tokens by construction; demote routing to a dev assertion": reclassifying
 * refused descends as removed+added would break handle identity continuity
 * for value-edited marks (MarkController.update flows pin same-id
 * inheritance), so commit.ts keeps its runtime mark-escalation branch.
 */
export type Changeset =
	| {kind: 'full'}
	| {
			kind: 'delta'
			textChanged: number[]
			added: number[]
			removed: number[]
			updated: number[]
	  }

export type ReconcileResult = {
	tokens: Token[]
	changeset: Changeset
}

export type IdentityTracker = {
	/**
	 * Match `next` against the previously reconciled tree. Reuses previous token
	 * objects by reference where the token (and its subtree) is byte-identical
	 * including position; carries the previous id onto tokens that are identical
	 * except for a uniform position shift. Everything else gets a fresh id.
	 * `hint` is the edit range in the previous value; when absent it is derived
	 * with findGap from the values (reconstructed from the token contents when
	 * not provided), and the changeset degrades to `full` only when no previous
	 * tree exists.
	 */
	reconcile(next: Token[], hint?: EditHint, previousValue?: string, nextValue?: string): ReconcileResult
	/**
	 * Stable id of a token from the last reconciled tree (or any reused
	 * ancestor). WRITE SIDE-EFFECT: assigns an id on first sight (and to the
	 * token's descendants). Intended for tokens belonging to the current
	 * reconciled tree; probing foreign tokens permanently allocates ids.
	 */
	idOf(token: Token): number
	/**
	 * Read-only peek: returns the existing id if the token has been seen before,
	 * or `undefined` if it has not — without allocating a new id. Unlike `idOf`,
	 * probing a foreign token with `idFor` is always safe and leaves no side-effect.
	 */
	idFor(token: Token): number | undefined
}

export function createIdentityTracker(): IdentityTracker {
	const ids = new WeakMap<Token, number>()
	let nextId = 1
	let previous: Token[] | undefined

	const ensureId = (token: Token): number => {
		let id = ids.get(token)
		if (id === undefined) {
			id = nextId++
			ids.set(token, id)
		}
		if (token.type === 'mark') token.children.forEach(ensureId)
		return id
	}

	/** Push the token's id AND all descendant ids into `bucket`. */
	const collectIds = (token: Token, bucket: number[]): void => {
		bucket.push(ensureId(token))
		if (token.type === 'mark') token.children.forEach(child => collectIds(child, bucket))
	}

	const inherit = (from: Token, to: Token): void => {
		const id = ids.get(from)
		if (id !== undefined) ids.set(to, id)
		if (from.type === 'mark' && to.type === 'mark') {
			const len = Math.min(from.children.length, to.children.length)
			for (let i = 0; i < len; i++) inherit(from.children[i], to.children[i])
			to.children.forEach(ensureId)
		}
	}

	return {
		idOf: token => ensureId(token),

		idFor: token => ids.get(token),

		reconcile(next, hint, previousValue, nextValue) {
			const prev = previous

			if (!prev) {
				next.forEach(ensureId)
				previous = next
				return {tokens: next, changeset: {kind: 'full'}}
			}

			// Top-level tokens partition the value, so the values can always be
			// reconstructed when the caller does not provide them.
			const window = hint ?? hintFromValues(previousValue ?? joinContents(prev), nextValue ?? joinContents(next))

			const shiftDelta = window.insertedLength - (window.end - window.start)
			const out: Token[] = next.slice()
			const textChanged: number[] = []
			const added: number[] = []
			const updated: number[] = []
			const matchedPrev = new Set<Token>()

			/**
			 * Deep descend (spec §Deep reconcile): an id-matched mark pair whose
			 * difference is confined to the slot interior becomes an UPDATE — the
			 * children carry the change at their own granularity. All four
			 * conditions must hold; any refusal keeps today's conservative
			 * mark-level textChanged (id inherited — handle continuity for
			 * refused descends is the pinned contract).
			 */
			const tryDescend = (prevMark: MarkToken, nextMark: MarkToken): boolean => {
				// 1. same descriptor (reference — interned per parser instance)
				if (!sameDescriptor(prevMark, nextMark)) return false
				// 2. rendered props byte-unchanged
				if (prevMark.value !== nextMark.value || prevMark.meta !== nextMark.meta) return false
				// 3. only the slot interior changed: the raw content before
				//    slot.start and after slot.end is byte-equal. Equality of the
				//    mark-relative slices pins the slot's offsets within the mark,
				//    so positions shift consistently by the parser invariant
				//    content.length === position.end - position.start.
				const prevSlot = prevMark.slot
				const nextSlot = nextMark.slot
				if (!prevSlot || !nextSlot) return false
				const prevBase = prevMark.position.start
				const nextBase = nextMark.position.start
				const headEqual =
					prevMark.content.slice(0, prevSlot.start - prevBase) ===
					nextMark.content.slice(0, nextSlot.start - nextBase)
				if (!headEqual) return false
				const tailEqual =
					prevMark.content.slice(prevSlot.end - prevBase) === nextMark.content.slice(nextSlot.end - nextBase)
				if (!tailEqual) return false
				// 4. children pair 1:1 structurally
				const prevKids = prevMark.children
				const nextKids = nextMark.children
				if (prevKids.length !== nextKids.length) return false
				for (let i = 0; i < prevKids.length; i++) {
					const a = prevKids[i]
					const b = nextKids[i]
					if (a.type !== b.type) return false
					if (a.type === 'mark' && b.type === 'mark' && !sameDescriptor(a, b)) return false
				}
				// Descend: pair the children inside the slot window, then carry the
				// id onto the new mark. ensureId runs AFTER pairing — the children
				// already hold their inherited ids, so no phantom allocations.
				const id = ids.get(prevMark)
				if (id !== undefined) ids.set(nextMark, id)
				pairSlotChildren(prevMark, nextMark, prevSlot, nextSlot)
				updated.push(ensureId(nextMark))
				return true
			}

			/**
			 * Children of a descended mark: the same prefix/suffix/middle pairing,
			 * scoped to the slot window. The window is derived minimally from the
			 * slot contents themselves (independent of how sloppy the outer window
			 * was); `headShift` moves children before the interior edit (the whole
			 * mark may have shifted), `tailShift` adds the interior growth for
			 * children after it. Condition 4 guarantees index-aligned pairs, so no
			 * child is ever added/removed here.
			 */
			const pairSlotChildren = (
				prevMark: MarkToken,
				nextMark: MarkToken,
				prevSlot: NonNullable<MarkToken['slot']>,
				nextSlot: NonNullable<MarkToken['slot']>
			): void => {
				const interior = hintFromValues(prevSlot.content, nextSlot.content)
				const start = prevSlot.start + interior.start
				const end = prevSlot.start + interior.end
				const headShift = nextSlot.start - prevSlot.start
				const tailShift = headShift + interior.insertedLength - (interior.end - interior.start)
				const prevKids = prevMark.children
				// Mutated in place: zero-shift matches reuse the previous OBJECT
				// (byte-identical, so the output still deep-equals a fresh parse).
				const kids = nextMark.children
				let lo = 0
				while (
					lo < prevKids.length &&
					prevKids[lo].position.end <= start &&
					tokensEqualShifted(prevKids[lo], kids[lo], headShift)
				) {
					if (headShift === 0) {
						kids[lo] = prevKids[lo]
					} else {
						inherit(prevKids[lo], kids[lo])
						collectIds(kids[lo], updated)
					}
					lo++
				}
				let hi = prevKids.length - 1
				while (
					hi >= lo &&
					prevKids[hi].position.start >= end &&
					tokensEqualShifted(prevKids[hi], kids[hi], tailShift)
				) {
					if (tailShift === 0) {
						kids[hi] = prevKids[hi]
					} else {
						inherit(prevKids[hi], kids[hi])
						collectIds(kids[hi], updated)
					}
					hi--
				}
				for (let i = lo; i <= hi; i++) {
					const a = prevKids[i]
					const b = kids[i]
					// nested marks descend recursively under the same four conditions
					if (a.type === 'mark' && b.type === 'mark' && tryDescend(a, b)) continue
					inherit(a, b)
					textChanged.push(ensureId(b))
				}
			}

			// 1. Prefix: tokens entirely before the edit window are identical incl.
			//    position → reuse the previous OBJECT.
			let p = 0
			while (
				p < prev.length &&
				p < next.length &&
				prev[p].position.end <= window.start &&
				tokensEqual(prev[p], next[p])
			) {
				out[p] = prev[p]
				matchedPrev.add(prev[p])
				p++
			}

			// 2. Suffix: walk from the ends; a previous token entirely after the edit
			//    window matches a next token when shifting its positions by
			//    shiftDelta makes them identical → new object, inherited id.
			let prevTail = prev.length - 1
			let nextTail = next.length - 1
			while (
				prevTail >= p &&
				nextTail >= p &&
				prev[prevTail].position.start >= window.end &&
				tokensEqualShifted(prev[prevTail], next[nextTail], shiftDelta)
			) {
				matchedPrev.add(prev[prevTail])
				if (shiftDelta !== 0) {
					inherit(prev[prevTail], next[nextTail])
					// descendants shifted too — collect the whole subtree
					collectIds(next[nextTail], updated)
				} else {
					out[nextTail] = prev[prevTail]
				}
				prevTail--
				nextTail--
			}

			// 3. Middle: same-index pairing for the window region — a token at the
			//    same tree slot with the same type+descriptor keeps its id. Paired
			//    MARKS first attempt the deep descend above; refused or non-mark
			//    pairs are reported as textChanged; everything else is added.
			//    NOTE: same-index type+descriptor pairing is a heuristic — a merged
			//    or unrelated text token landing in the same slot inherits the old
			//    id and reports textChanged. That is acceptable: any token-count
			//    change puts ids in added/removed (the structural path), and the
			//    equivalence property in the spec guards output correctness; id
			//    attribution here is best-effort continuity, not semantics.
			for (let i = p; i <= nextTail; i++) {
				const candidate = i <= prevTail ? prev[i] : undefined
				const token = next[i]
				if (
					candidate !== undefined &&
					!matchedPrev.has(candidate) &&
					(candidate.type === 'mark'
						? token.type === 'mark' && sameDescriptor(candidate, token)
						: candidate.type === token.type)
				) {
					matchedPrev.add(candidate)
					if (candidate.type === 'mark' && token.type === 'mark' && tryDescend(candidate, token)) continue
					inherit(candidate, token)
					textChanged.push(ensureId(token))
				} else {
					collectIds(token, added)
				}
			}

			const removed: number[] = []
			for (const t of prev) if (!matchedPrev.has(t)) collectIds(t, removed)

			// Invariant: every element of the OUTPUT tree has an id. Prefix-reused
			// prev objects already carry one; suffix/middle/added tokens got theirs
			// above — this is a cheap final guarantee. Deliberately NOT `next`:
			// running ensureId over the discarded next-array tokens (the ones
			// replaced by reused prev objects in `out`) would allocate phantom ids.
			out.forEach(ensureId)
			previous = out
			return {
				tokens: out,
				changeset: {kind: 'delta', textChanged, added, removed, updated},
			}
		},
	}
}

function joinContents(tokens: readonly Token[]): string {
	return tokens.map(token => token.content).join('')
}

function hintFromValues(previousValue: string, nextValue: string): EditHint {
	const gap = findGap(previousValue, nextValue)
	// findGap contract (see preparsing/utils/findGap.spec.ts):
	// - `left` is the first diverging index, i.e. the common prefix length;
	//   undefined when the previous value is a prefix of the next one.
	// - `right` is the ABSOLUTE exclusive end of the gap in the PREVIOUS value
	//   (previous.length - commonSuffixLength); undefined when the previous
	//   value is a suffix of the next one. It is NOT measured from the end.
	const prefix = gap.left ?? previousValue.length
	const suffix = gap.right === undefined ? previousValue.length : previousValue.length - gap.right
	// Prefix and suffix may overlap (e.g. 'aa' → 'aaa'); clamp the suffix so the
	// window stays a valid range in both values.
	const clampedSuffix = Math.min(suffix, Math.min(previousValue.length, nextValue.length) - prefix)
	const start = prefix
	const end = previousValue.length - clampedSuffix
	const insertedLength = nextValue.length - clampedSuffix - start
	return {start, end, insertedLength}
}

function tokensEqual(a: Token, b: Token): boolean {
	return tokensEqualShifted(a, b, 0)
}

function tokensEqualShifted(a: Token, b: Token, delta: number): boolean {
	// Fast path: a reused object is equal to itself exactly when nothing shifted.
	if (a === b) return delta === 0
	if (a.type !== b.type) return false
	if (a.content !== b.content) return false
	if (a.position.start + delta !== b.position.start || a.position.end + delta !== b.position.end) return false
	if (a.type === 'mark' && b.type === 'mark') {
		if (!sameDescriptor(a, b) || a.value !== b.value || a.meta !== b.meta) return false
		if (a.children.length !== b.children.length) return false
		return a.children.every((child, i) => tokensEqualShifted(child, b.children[i], delta))
	}
	return true
}

function sameDescriptor(a: MarkToken, b: MarkToken): boolean {
	return a.descriptor === b.descriptor
}