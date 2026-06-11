import type {Range} from '../../shared/editorContracts'
import {signal, untracked} from '../../shared/signals/index.js'
import {replaceInString} from '../../shared/utils'
import type {PropsModel} from './PropsModel'

export class ValueModel {
	/** Consume-once edit hint recorded by {@link replace}; see {@link takePendingEdit}. */
	#pendingEdit: {start: number; end: number; insertedLength: number} | undefined

	/** Effective value before the most recent accepted write; see {@link previousValue}. */
	#previousValue: string | undefined

	readonly current = signal({
		initial: () => this.props.defaultValue() ?? '',
		get: value => (this.props.value() !== undefined ? (this.props.value() ?? '') : value),
		set: (next, previous) => {
			if (next === undefined) return previous
			if (this.props.readOnly()) return previous
			// Capture point for #previousValue: every accepted write — replace()
			// and direct current(...) sets alike — funnels through this transform
			// SYNCHRONOUSLY before the stored value changes, so readers never see
			// a half-updated pair (unlike a watch(), which only fires at effect
			// flush). untracked: a write inside a reactive scope must not link
			// `current` as a dependency of that scope. Controlled-mode changes
			// applied purely through props.value (without a local write) bypass
			// this — consumers treat #previousValue as best-effort (TokenModel's
			// identity tracker reconstructs the true value from tokens otherwise).
			this.#previousValue = untracked(() => this.current())
			this.props.onChange()?.(next)
			return this.props.value() !== undefined ? previous : next
		},
	})

	constructor(private readonly props: PropsModel) {}

	/**
	 * Consume-once hint describing the most recent value-changing `replace()`
	 * (range in the previous value plus inserted length); `undefined` for
	 * direct `current(...)` sets or when already consumed.
	 */
	takePendingEdit(): {start: number; end: number; insertedLength: number} | undefined {
		const hint = this.#pendingEdit
		this.#pendingEdit = undefined
		return hint
	}

	/** Value as it was before the most recent accepted `current()` write. */
	previousValue(): string | undefined {
		return this.#previousValue
	}

	/**
	 * Attempts to replace `range` with `replacement`. Returns `true` when the
	 * edit was accepted (range valid and not read-only), `false` otherwise.
	 * Callers use the return value to gate downstream side effects such as
	 * caret placement.
	 */
	replace(range: Range, replacement: string): boolean {
		if (this.props.readOnly()) return false
		const current = this.current()
		const next = replaceInString(current, range, replacement)
		if (next === undefined) return false
		// Record the hint only when the value actually changes — a no-op replace
		// would leave a stale hint behind for a later unrelated set. The range is
		// already normalized here: EditController resolves `end < 0` before
		// calling, and replaceInString rejected anything out of bounds above.
		if (next !== current)
			this.#pendingEdit = {start: range.start, end: range.end, insertedLength: replacement.length}
		this.current(next)
		return true
	}
}