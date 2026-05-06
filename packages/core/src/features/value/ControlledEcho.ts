import type {CaretRecovery} from '../../shared/editorContracts'

type PendingEcho = {
	candidate: string
	recovery: CaretRecovery | undefined
}

export class ControlledEcho {
	#pending: PendingEcho | undefined

	setPending(candidate: string, recovery: CaretRecovery | undefined): void {
		this.#pending = {candidate, recovery}
	}

	onEcho(value: string): CaretRecovery | undefined {
		const pending = this.#pending
		if (!pending) return undefined
		this.#pending = undefined
		return pending.candidate === value ? pending.recovery : undefined
	}
}