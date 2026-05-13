import type {Range} from '../../shared/editorContracts'
import {computed, model} from '../../shared/signals/index.js'
import {replaceInString} from '../../shared/utils'
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

	replace(range: Range, replacement: string): void {
		const next = replaceInString(this.current(), range, replacement)
		if (next === undefined) return
		this.current(next)
	}
}