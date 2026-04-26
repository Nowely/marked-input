import type {CaretRecovery} from '../../shared/editorContracts'

type Pending = {
	readonly candidate: string
	readonly recovery: CaretRecovery | undefined
}

export class ControlledEcho {
	#pending: Pending | undefined

	propose(candidate: string, recovery?: CaretRecovery): void {
		this.#pending = {candidate, recovery}
	}

	onEcho(value: string): CaretRecovery | undefined {
		const pending = this.#pending
		if (!pending) return undefined
		this.#pending = undefined
		return pending.candidate === value ? pending.recovery : undefined
	}

	supersede(): void {
		this.#pending = undefined
	}
}