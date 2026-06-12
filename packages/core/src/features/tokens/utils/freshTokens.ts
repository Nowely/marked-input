import type {Token} from '../parser/types'

type FreshSource = {
	tree(): Token[]
	handleOf(token: Token): {token(): Token} | undefined
}

/**
 * Fresh top-level token read over the live node layer. `tree()` keeps its
 * reference (and therefore stale content/positions) across text-path commits;
 * the per-token id bridge swaps each row for its handle's CURRENT token. A
 * fresh mark token carries fresh children, so the map never needs to recurse.
 *
 * Always current: on the text path the handles are fresh; while a structural
 * apply awaits its bind `handleOf` fails closed but `tree()` itself was just
 * reassigned — the fallback IS the fresh token. A token without a handle
 * (never bound — e.g. created during a transient DOM-walk bail) also entered
 * via a structural commit, so its tree object is fresh by the same argument
 * until the next successful bind materializes its handle.
 */
export function freshTokens(tokens: FreshSource): Token[] {
	return tokens.tree().map(token => tokens.handleOf(token)?.token() ?? token)
}