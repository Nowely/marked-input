import type {RawRange} from '../../shared/editorContracts'
import {computed, model} from '../../shared/signals/index.js'
import type {PropsModel} from '../props/PropsModel'

export class ValueModel {
	readonly isControlledMode = computed(() => this.props.value() !== undefined)

	readonly current = model<string>({
		default: () => this.props.defaultValue() ?? '',
		get: value => (this.isControlledMode() ? (this.props.value() ?? '') : value),
		set: (next, previous) => {
			if (next === undefined) return previous
			if (this.props.readOnly()) return previous
			this.props.onChange()?.(next)
			return this.isControlledMode() ? previous : next
		},
	})

	constructor(private readonly props: PropsModel) {}

	replace(range: RawRange, replacement: string): void {
		const current = this.current()
		if (range.start < 0 || range.end < range.start || range.end > current.length) return
		const next = current.slice(0, range.start) + replacement + current.slice(range.end)
		this.current(next)
	}
}