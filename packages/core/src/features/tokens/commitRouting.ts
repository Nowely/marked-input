import type {Token} from './parser/types'
import type {Changeset} from './tokenIdentity'

/**
 * Text path ⇔ delta with no added/removed and every textChanged id is a TEXT
 * token. A textChanged MARK routes structural: mark components render
 * value/meta as framework props, so the renderer must run.
 */
export function isTextPath(tokens: readonly Token[], changeset: Changeset, idOf: (t: Token) => number): boolean {
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
	return true
}