import type {RawRange} from '../../shared/editorContracts'
import {computed, model, signal} from '../../shared/signals/index.js'
import type {PropsModel} from '../props/PropsModel'

export class ValueModel {
	readonly isControlledMode = computed(() => this.props.value() !== undefined)

	// Tracks whether the user has accepted a write into the uncontrolled internal.
	// While false, uncontrolled reads surface props.defaultValue() rather than
	// the model's internal seed, matching the old writable computed's lazy
	// initial behavior (initial ran only when get demanded the value).
	private readonly userWritten = signal(false)

	readonly current = model<string>({
		default: () => '',
		get: value => {
			if (this.isControlledMode()) return this.props.value() ?? ''
			if (this.userWritten()) return value
			return this.props.defaultValue() ?? ''
		},
		set: (next, previous) => {
			if (next === undefined) return previous
			if (this.props.readOnly()) return previous
			this.props.onChange()?.(next)
			if (this.isControlledMode()) return previous
			this.userWritten(true)
			return next
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