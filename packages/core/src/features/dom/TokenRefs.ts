import type {DomRef, TokenPath} from '../../shared/editorContracts'
import {pathEquals} from '../parsing/tokenIndex'

type ControlRegistration = {
	readonly ownerPath?: TokenPath
	readonly element: HTMLElement
}

type ChildSequenceRegistration = {
	readonly ownerPath: TokenPath
	readonly element: HTMLElement
}

export class TokenRefs {
	readonly #pendingControls = new Map<string, ControlRegistration>()
	readonly #pendingChildSequences = new Map<string, ChildSequenceRegistration>()
	#nextControlId = 0
	#nextChildSequenceId = 0

	control(ownerPath?: TokenPath): DomRef {
		const key = `control:${++this.#nextControlId}`
		return element => {
			if (element) {
				this.#pendingControls.set(key, {ownerPath: ownerPath ? [...ownerPath] : undefined, element})
			} else {
				this.#pendingControls.delete(key)
			}
		}
	}

	children(ownerPath: TokenPath): DomRef {
		const key = `children:${++this.#nextChildSequenceId}`
		return element => {
			if (element) {
				this.#pendingChildSequences.set(key, {ownerPath: [...ownerPath], element})
			} else {
				this.#pendingChildSequences.delete(key)
			}
		}
	}

	controlElements(): ReadonlySet<HTMLElement> {
		const out = new Set<HTMLElement>()
		for (const {element} of this.#pendingControls.values()) out.add(element)
		return out
	}

	childSequenceHostsFor(ownerPath: TokenPath): HTMLElement[] {
		const out: HTMLElement[] = []
		for (const registration of this.#pendingChildSequences.values()) {
			if (pathEquals(registration.ownerPath, ownerPath)) out.push(registration.element)
		}
		return out
	}
}