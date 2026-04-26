import type {CaretRecovery, EditResult, EditSource, RawRange} from '../../shared/editorContracts'
import {signal, computed, event, batch, effectScope, watch} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import {ControlledEcho} from './ControlledEcho'

export class ValueFeature implements Feature {
	readonly current = signal('')
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	readonly #controlledEcho = new ControlledEcho()
	#scope?: () => void

	constructor(private readonly _store: Store) {}

	enable() {
		if (this.#scope) return
		this.#commitAccepted(this._store.props.value() ?? this._store.props.defaultValue() ?? '')
		this.#scope = effectScope(() => {
			watch(this._store.props.value, value => {
				if (value === undefined) return
				if (value === this.current()) return
				const recovery = this.#controlledEcho.onEcho(value)
				this.#commitAccepted(value)
				if (recovery) this._store.caret.recovery(recovery)
				this.change()
			})
		})
	}

	disable() {
		this.#scope?.()
		this.#scope = undefined
	}

	replaceRange(
		range: RawRange,
		replacement: string,
		options?: {recover?: CaretRecovery; source?: EditSource}
	): EditResult {
		const current = this.current()
		if (this._store.props.readOnly()) return {ok: false, reason: 'readOnly'}
		if (range.start < 0 || range.end < range.start || range.end > current.length) {
			return {ok: false, reason: 'invalidRange'}
		}

		const candidate = current.slice(0, range.start) + replacement + current.slice(range.end)
		return this.#commitCandidate(candidate, options?.recover)
	}

	replaceAll(next: string, options?: {recover?: CaretRecovery; source?: EditSource}): EditResult {
		return this.replaceRange({start: 0, end: this.current().length}, next, options)
	}

	#commitCandidate(candidate: string, recovery?: CaretRecovery): EditResult {
		if (this.isControlledMode()) {
			this.#controlledEcho.propose(candidate, recovery)
			this._store.props.onChange()?.(candidate)
			return {ok: true, accepted: 'pendingControlledEcho', value: candidate}
		}

		this._store.props.onChange()?.(candidate)
		this.#commitAccepted(candidate)
		this._store.caret.recovery(recovery)
		this.change()
		return {ok: true, accepted: 'immediate', value: candidate}
	}

	#commitAccepted(value: string) {
		const tokens = this._store.parsing.parseValue(value)
		batch(() => {
			this._store.parsing.acceptTokens(tokens)
			this.current(value)
		})
	}
}