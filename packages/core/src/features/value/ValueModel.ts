import type {RawRange} from '../../shared/editorContracts'
import {computed} from '../../shared/signals/index.js'
import type {PropsModel} from '../props/PropsModel'

export class ValueModel {
	readonly isControlledMode = computed(() => this.props.value() !== undefined)

	readonly current = computed<string>({
		initial: () => this.props.value() ?? this.props.defaultValue() ?? '',
		get: field => (this.isControlledMode() ? (this.props.value() ?? '') : field()),
		set: (next, field) => {
			if (next === undefined) return
			if (this.props.readOnly()) return
			if (!this.isControlledMode()) field(next)
			this.props.onChange()?.(next)
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