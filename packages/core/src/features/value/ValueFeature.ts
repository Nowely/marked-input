import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {signal, computed, event, batch, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

export class ValueFeature {
	readonly current = signal('')
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	#pendingEcho: {value: string; recovery: CaretRecovery | undefined} | undefined

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			this.#initializeFromProps()
			this.#subscribeToControlledValue()
		})
	}

	replaceRange(range: RawRange, replacement: string, options?: {recover?: CaretRecovery}): void {
		const current = this.current()
		if (this._store.props.readOnly()) return
		if (range.start < 0 || range.end < range.start || range.end > current.length) return

		const next = current.slice(0, range.start) + replacement + current.slice(range.end)
		if (this.isControlledMode()) {
			this.#proposeToParent(next, options?.recover)
		} else {
			this.#applyLocally(next, options?.recover)
		}
	}

	replaceAll(next: string, options?: {recover?: CaretRecovery}): void {
		return this.replaceRange({start: 0, end: this.current().length}, next, options)
	}

	// --- controlled path ---

	#proposeToParent(next: string, recovery: CaretRecovery | undefined): void {
		this.#pendingEcho = {value: next, recovery}
		this._store.props.onChange()?.(next)
	}

	#onParentEcho(value: string): void {
		if (value === this.current()) return
		const pending = this.#pendingEcho
		this.#pendingEcho = undefined
		const recovery = pending?.value === value ? pending.recovery : undefined
		this.#accept(value)
		if (recovery) this._store.caret.recovery(recovery)
		this.change()
	}

	// --- uncontrolled path ---

	#applyLocally(next: string, recovery: CaretRecovery | undefined): void {
		this._store.props.onChange()?.(next)
		this.#accept(next)
		this._store.caret.recovery(recovery)
		this.change()
	}

	// --- shared ---

	#accept(value: string): void {
		const tokens = this._store.parsing.parseValue(value)
		batch(() => {
			this._store.parsing.acceptTokens(tokens)
			this.current(value)
		})
	}

	// --- setup ---

	#initializeFromProps(): void {
		this.#accept(this._store.props.value() ?? this._store.props.defaultValue() ?? '')
	}

	#subscribeToControlledValue(): void {
		watch(this._store.props.value, value => {
			if (value !== undefined) this.#onParentEcho(value)
		})
	}
}