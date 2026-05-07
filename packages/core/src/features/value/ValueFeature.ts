import type {RawRange} from '../../shared/editorContracts'
import {computed} from '../../shared/signals/index.js'
import type {PropsFeature} from '../props/PropsFeature'

export class ValueFeature {
	readonly isControlledMode = computed(() => this.props.value() !== undefined)

	readonly current = computed<string>({
		initial: () => this.props.value() ?? this.props.defaultValue() ?? '',
		get: field => (this.isControlledMode() ? (this.props.value() ?? '') : field()),
		set: (next, field) => {
			if (next === undefined) return
			if (!this.isControlledMode()) field(next)
			this.props.onChange()?.(next)
		},
	})

	constructor(private readonly props: PropsFeature) {}

	replaceRange(range: RawRange, replacement: string): void {
		const cur = this.current()
		if (this.props.readOnly()) return
		if (range.start < 0 || range.end < range.start || range.end > cur.length) return
		const next = cur.slice(0, range.start) + replacement + cur.slice(range.end)
		if (next === cur) return
		this.current(next)
	}

	replaceAll(next: string): void {
		return this.replaceRange({start: 0, end: this.current().length}, next)
	}
}