import type {Range} from '../../shared/editorContracts'
import {signal} from '../../shared/signals/index.js'
import {replaceInString} from '../../shared/utils'
import type {PropsModel} from './PropsModel'

export class ValueModel {
	readonly current = signal({
		initial: () => this.props.defaultValue() ?? '',
		get: value => (this.props.value() !== undefined ? (this.props.value() ?? '') : value),
		set: (next, previous) => {
			if (next === undefined) return previous
			if (this.props.readOnly()) return previous
			this.props.onChange()?.(next)
			return this.props.value() !== undefined ? previous : next
		},
	})

	constructor(private readonly props: PropsModel) {}

	/**
	 * Attempts to replace `range` with `replacement`. Returns `true` when the
	 * edit was accepted (range valid and not read-only), `false` otherwise.
	 * Callers use the return value to gate downstream side effects such as
	 * caret placement.
	 */
	replace(range: Range, replacement: string): boolean {
		if (this.props.readOnly()) return false
		const next = replaceInString(this.current(), range, replacement)
		if (next === undefined) return false
		this.current(next)
		return true
	}
}