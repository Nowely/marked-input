import type {Token} from '../types'

/**
 * Block mode's parse policy (spec §1.2, §2.3): drop zero-length TOP-LEVEL text
 * tokens so rows are the only roots. Deliberately not recursive — a slot's
 * children are its content and an empty one there is real.
 *
 * Consequence the addressing model depends on: with no text token between two
 * rows, a between-row position has no `TextNode` and is addressed by
 * `{after: rowNode}`.
 */
export function filterEmptyText(tokens: readonly Token[]): Token[] {
	return tokens.filter(token => token.type !== 'text' || token.position.start !== token.position.end)
}