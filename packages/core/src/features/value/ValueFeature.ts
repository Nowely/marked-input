import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {computed, event, batch, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export class ValueFeature {
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	readonly current = computed<string>({
		initial: () => this._store.props.value() ?? this._store.props.defaultValue() ?? '',
		get: field => (this.isControlledMode() ? (this._store.props.value() ?? '') : field()),
		set: (next, field) => {
			if (next === undefined) return
			if (this.isControlledMode()) {
				this._store.props.onChange()?.(next)
			} else {
				field(next)
				this._store.props.onChange()?.(next)
			}
		},
	})

	#pending: {value: string; recovery: CaretRecovery | undefined} | undefined

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			this.#accept(this.current())
			watch(this.current, v => {
				this.#accept(v)
				this.change()
			})
		})
	}

	replaceRange(range: RawRange, replacement: string, options?: {recover?: CaretRecovery}): void {
		const cur = this.current()
		if (this._store.props.readOnly()) return
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
		const tokens = this._store.parsing.parseValue(value)
		batch(() => this._store.parsing.acceptTokens(tokens))
		if (pending?.value === value) {
			this._store.caret.recovery(pending.recovery)
		}
	}
}