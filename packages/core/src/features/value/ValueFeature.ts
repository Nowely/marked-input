import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {computed, event, watch} from '../../shared/signals/index.js'
import type {CaretFeature} from '../caret/CaretFeature'
import type {LifecycleFeature} from '../lifecycle/LifecycleFeature'
import type {PropsFeature} from '../props/PropsFeature'

export class ValueFeature {
	readonly isControlledMode = computed(() => this.props.value() !== undefined)
	readonly change = event()

	readonly current = computed<string>({
		initial: () => this.props.value() ?? this.props.defaultValue() ?? '',
		get: field => (this.isControlledMode() ? (this.props.value() ?? '') : field()),
		set: (next, field) => {
			if (next === undefined) return
			if (!this.isControlledMode()) field(next)
			this.props.onChange()?.(next)
		},
	})

	#pending: {value: string; recovery: CaretRecovery | undefined} | undefined

	constructor(
		private readonly lifecycle: LifecycleFeature,
		private readonly props: PropsFeature,
		private readonly caret: CaretFeature
	) {
		lifecycle.onMounted(() => {
			this.#accept(this.current())
			watch(this.current, v => {
				this.#accept(v)
				this.change()
			})
		})
	}

	replaceRange(range: RawRange, replacement: string, options?: {recover?: CaretRecovery}): void {
		const cur = this.current()
		if (this.props.readOnly()) return
		if (range.start < 0 || range.end < range.start || range.end > cur.length) return

		const next = cur.slice(0, range.start) + replacement + cur.slice(range.end)
		if (next === cur) return
		this.#pending = {value: next, recovery: options?.recover}
		this.current(next)
	}

	replaceAll(next: string, options?: {recover?: CaretRecovery}): void {
		return this.replaceRange({start: 0, end: this.current().length}, next, options)
	}

	#accept(value: string): void {
		const pending = this.#pending
		this.#pending = undefined
		if (pending?.value === value) {
			this.caret.recovery(pending.recovery)
		}
	}
}