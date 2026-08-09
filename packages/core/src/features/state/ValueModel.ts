import type {Range} from '../../shared/editorContracts'
import {computed} from '../../shared/signals/index.js'
import type {TokenModel} from '../tokens'

/**
 * Facade over the token layer's value. The tree is the source of truth and the
 * string is its projection (spec D1), so this class owns nothing: it exists for one
 * more phase because ~8 call sites read `value.current()` and moving them all in the
 * cutover commit would bury the wiring change. S1.8 deletes it and repoints them at
 * the token layer.
 */
export class ValueModel {
	readonly current = computed({
		get: () => this.tokens.value(),
		set: next => void this.tokens.replace({start: 0, end: -1}, next),
	})

	constructor(private readonly tokens: TokenModel) {}

	/** Global-range write. Gating (readOnly, bounds) lives in the transaction layer. */
	replace(range: Range, replacement: string): boolean {
		return this.tokens.replace(range, replacement)
	}
}