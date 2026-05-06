import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {signal, computed, event, batch, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'
import {ControlledEcho} from './ControlledEcho'

export class ValueFeature {
	readonly current = signal('')
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	readonly #controlledEcho = new ControlledEcho()

	constructor(private readonly _store: Store) {
		_store.lifecycle.onMounted(() => {
			this.#commitAccepted(_store.props.value() ?? _store.props.defaultValue() ?? '')
			watch(_store.props.value, value => {
				if (value === undefined) return
				if (value === this.current()) return
				const recovery = this.#controlledEcho.onEcho(value)
				this.#commitAccepted(value)
				if (recovery) _store.caret.recovery(recovery)
				this.change()
			})
		})
	}

	replaceRange(range: RawRange, replacement: string, options?: {recover?: CaretRecovery}): void {
		const current = this.current()
		if (this._store.props.readOnly()) return
		if (range.start < 0 || range.end < range.start || range.end > current.length) {
			return
		}

		const candidate = current.slice(0, range.start) + replacement + current.slice(range.end)
		return this.#commitCandidate(candidate, options?.recover)
	}

	replaceAll(next: string, options?: {recover?: CaretRecovery}): void {
		return this.replaceRange({start: 0, end: this.current().length}, next, options)
	}

	#commitCandidate(candidate: string, recovery?: CaretRecovery): void {
		if (this.isControlledMode()) {
			this.#controlledEcho.setPending(candidate, recovery)
			this._store.props.onChange()?.(candidate)
			return
		}

		this._store.props.onChange()?.(candidate)
		this.#commitAccepted(candidate)
		this._store.caret.recovery(recovery)
		this.change()
	}

	#commitAccepted(value: string) {
		const tokens = this._store.parsing.parseValue(value)
		batch(() => {
			this._store.parsing.acceptTokens(tokens)
			this.current(value)
		})
	}
}