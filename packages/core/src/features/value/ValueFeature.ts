import type {CaretRecovery, RawRange} from '../../shared/editorContracts'
import {signal, computed, event, batch, effectScope, watch} from '../../shared/signals/index.js'
import type {Store} from '../../store/Store'

type PendingEcho = {
	candidate: string
	recovery: CaretRecovery | undefined
}

export class ValueFeature {
	readonly current = signal('')
	readonly isControlledMode = computed(() => this._store.props.value() !== undefined)
	readonly change = event()

	#pendingEcho: PendingEcho | undefined
	#scope?: () => void

	constructor(private readonly _store: Store) {
		watch(this._store.lifecycle.mounted, () => {
			if (this.#scope) return
			this.#commitAccepted(this._store.props.value() ?? this._store.props.defaultValue() ?? '')
			this.#scope = effectScope(() => {
				watch(this._store.props.value, value => {
					if (value === undefined) return
					if (value === this.current()) return
					const recovery = this.#echoResult(value)
					this.#commitAccepted(value)
					if (recovery) this._store.caret.recovery(recovery)
					this.change()
				})
			})
		})
		watch(this._store.lifecycle.unmounted, () => {
			this.#scope?.()
			this.#scope = undefined
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
			this.#pendingEcho = {candidate, recovery}
			this._store.props.onChange()?.(candidate)
			return
		}

		this._store.props.onChange()?.(candidate)
		this.#commitAccepted(candidate)
		this._store.caret.recovery(recovery)
		this.change()
	}

	#echoResult(value: string): CaretRecovery | undefined {
		const pending = this.#pendingEcho
		if (!pending) return undefined
		this.#pendingEcho = undefined
		return pending.candidate === value ? pending.recovery : undefined
	}

	#commitAccepted(value: string) {
		const tokens = this._store.parsing.parseValue(value)
		batch(() => {
			this._store.parsing.acceptTokens(tokens)
			this.current(value)
		})
	}
}