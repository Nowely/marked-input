import type {Token} from './parser/types'
import type {Changeset} from './tokenIdentity'

/**
 * Escape hatch for A/B debugging: when `false`, every reconcile is classified
 * structural — `structure()` returns a fresh reference each wave (so adapters
 * re-render and drive a full commit through `rendered()`) and TokenModel's
 * patch watch never passes its `isTextPath` guard, restoring the pre-Phase-3
 * pipeline end to end. Flip in source to disable; no runtime override by
 * design (a runtime flag would require every hot-path caller to re-read it on
 * every keystroke). Follows the same escape-hatch pattern as `INCREMENTAL`.
 */
export const FINE_GRAINED: boolean = true

/**
 * Text path ⇔ delta with no added/removed and every textChanged id is a TEXT
 * token. A textChanged MARK routes structural: mark components render
 * value/meta as framework props, so the renderer must run.
 *
 * {@link FINE_GRAINED} cuts here — the single point both consumers gate on:
 * the `structure` computed (reference reuse) and TokenModel's patch watch.
 */
export function isTextPath(tokens: readonly Token[], changeset: Changeset, idOf: (t: Token) => number): boolean {
	if (!FINE_GRAINED) return false
	if (changeset.kind !== 'delta') return false
	if (changeset.added.length > 0 || changeset.removed.length > 0) return false
	if (changeset.textChanged.length === 0 && changeset.shifted.length === 0) return true
	const textChanged = new Set(changeset.textChanged)
	let pending = textChanged.size
	const stack = [...tokens]
	while (stack.length > 0 && pending > 0) {
		const token = stack.pop()
		if (!token) break
		if (textChanged.has(idOf(token))) {
			if (token.type !== 'text') return false
			pending--
		}
		if (token.type === 'mark') stack.push(...token.children)
	}
	// Conservative: an unverifiable id (not found in the tree) routes structural.
	return pending === 0
}