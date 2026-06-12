// Patch-commit helpers: the free-function half of TokenModel's commit machinery
// (pass 1 of #patchCommit, the divergence detector, and its build-time flag).
// TokenModel keeps the stateful #commit/#patchCommit methods; everything here
// is pure over its inputs and unit-testable without a mounted store.

import type {TokenNode} from './domTypes'
import type {Token} from './parser/types'
import type {TokenIndex} from './tokenIndex'

/**
 * Dev-mode guard: active in Vitest and in any downstream bundler's dev build.
 *
 * `import.meta.env?.DEV` is resolved by the consumer's bundler at build time:
 * - Vitest (lib built by Vite): `import.meta.env.DEV === true` → always on in tests.
 * - Downstream production bundle: bundler replaces with `false` → stripped.
 * - Downstream dev bundle / unknown runtimes: `?? true` keeps the check live.
 *
 * Published adapter artifacts (react, vue) preserve the expression for
 * consumer-bundler substitution. Core's own dist build bakes this to `false`,
 * but core's package exports currently point at source, not dist, so consumers
 * always see the expression — revisit if core's exports ever switch to dist.
 * Follows the same escape-hatch pattern as `INCREMENTAL`.
 */
// oxlint-disable-next-line typescript/no-unnecessary-condition -- intentional runtime guard; value depends on bundler
export const VERIFY_DOM: boolean = import.meta.env?.DEV ?? true

/**
 * Assert that every node with a text surface has `textContent` matching its
 * token's `content`. Throws inside the `#committing` guard so the error
 * surfaces immediately. Error message format:
 * `TokenModel divergence at [path]: DOM "..." ≠ model "..."`
 *
 * Rebuild path: called AFTER `indexed()` so the SelectionController sweep has
 * already run — any remaining mismatch is genuine drift the sweep failed to fix.
 *
 * Patch path: called over only the patched targets — AFTER pass-2 writes and
 * BEFORE `indexed()`. Pass-2 wrote them itself, so a mismatch means a missed or
 * incomplete write.
 */
export function assertNoDivergence(nodes: Iterable<TokenNode>): void {
	for (const node of nodes) {
		if (!node.textElement) continue
		const actual = node.textElement.textContent
		const expected = node.address.token.content
		if (actual !== expected) {
			throw new Error(`TokenModel divergence at [${node.path.join(', ')}]: DOM "${actual}" ≠ model "${expected}"`)
		}
	}
}

export type PreparedPatch = {
	readonly byPath: ReadonlyMap<string, TokenNode>
	readonly byId: ReadonlyMap<number, TokenNode>
	readonly targets: readonly {
		readonly path: readonly number[]
		readonly element: HTMLElement
		readonly content: string
	}[]
}

/**
 * Pass 1 of the text-path patch commit — pure resolution, no state or DOM
 * mutation: refresh each indexed node's address from the new token index and
 * resolve every changed id to its text surface. Returns undefined when any
 * lookup fails (unresolvable path, changed id missing from the projection, or
 * target without a text surface) so the caller can escalate to a full
 * structural rebuild — the design spec's "Error handling" section mandates
 * escalation over silently dropping the edit. Exported for spec coverage:
 * text-path routing invariants make the failure branches unreachable through
 * the public API (buildIndex always gives text tokens a surface; paths are
 * stable on the text path), so they are unit-tested directly.
 */
export function preparePatch(
	previous: ReadonlyMap<string, TokenNode>,
	index: TokenIndex,
	idOf: (token: Token) => number,
	textChanged: readonly number[]
): PreparedPatch | undefined {
	const byPath = new Map<string, TokenNode>()
	const byId = new Map<number, TokenNode>()
	for (const [key, node] of previous) {
		const address = index.addressFor(node.path)
		if (!address) return undefined
		const refreshed: TokenNode = {...node, address}
		byPath.set(key, refreshed)
		byId.set(idOf(refreshed.address.token), refreshed)
	}
	const targets: {path: readonly number[]; element: HTMLElement; content: string}[] = []
	for (const id of textChanged) {
		const node = byId.get(id)
		if (!node?.textElement) return undefined
		targets.push({path: node.path, element: node.textElement, content: node.address.token.content})
	}
	return {byPath, byId, targets}
}