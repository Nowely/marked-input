import type {MarkToken} from '.'
import type {MarkPatch} from '../../shared/editorContracts'
import type {Store} from '../../store'
import type {TokenHandle} from './model/LiveNode'
import {annotate} from './parser/utils/annotate'

/**
 * Handle-backed mark command surface. The controller holds a {@link TokenHandle},
 * not a frozen `{address, snapshot}` capture: `value`/`meta`/`slot`/`readOnly`
 * are LIVE reads of the handle's current token, so they track text-path commits
 * (and the controller's own updates after re-bind) without re-capture. `update`/
 * `remove` resolve the live mark first; against a pending (mid-window) or dead
 * handle, or in read-only mode, they are a fail-closed no-op.
 */
export class MarkController {
	constructor(
		private readonly store: Store,
		private readonly handle: TokenHandle
	) {}

	static fromToken(store: Store, token: MarkToken): MarkController {
		// The adapter hands in a render-tree token; bridge by its stable id (the
		// Phase-1 plain field) to the live handle. A token outside the current tree
		// (no id, or no live node) has no controller — same failure surface as the
		// old pathOf throw.
		if (token.id === undefined) throw new Error('Cannot create MarkController for a token without an id')
		const handle = store.tokens.handle(token.id)
		if (!handle) throw new Error('Cannot create MarkController for a token outside the current tree')
		return new MarkController(store, handle)
	}

	/** The live mark token at this handle, or undefined (dead, mid-window, or no longer a mark). */
	#liveMark(): MarkToken | undefined {
		// Re-resolve through the LATCH-GATED id lookup: handle(id) serves undefined
		// while a structural apply awaits its bind (the node layer is one generation
		// stale there — the captured handle still points at the OLD DOM/token). A
		// killed mark drops out of the map entirely. Only a live, bound, still-mark
		// handle yields a token to mutate.
		const handle = this.store.tokens.handle(this.handle.id)
		if (handle !== this.handle || !handle.alive()) return undefined
		const token = handle.token()
		return token.type === 'mark' ? token : undefined
	}

	get value(): string {
		return this.#liveMark()?.value ?? ''
	}

	get meta(): string | undefined {
		return this.#liveMark()?.meta
	}

	get slot(): string | undefined {
		return this.#liveMark()?.slot?.content
	}

	get readOnly(): boolean {
		return this.store.props.readOnly()
	}

	remove(): boolean {
		const token = this.#resolve()
		if (!token) return false
		this.store.value.replace(token.position, '')
		return true
	}

	update(patch: MarkPatch): boolean {
		const token = this.#resolve()
		if (!token) return false

		const value = patch.value ?? token.value
		const meta =
			patch.meta?.kind === 'clear' ? undefined : patch.meta?.kind === 'set' ? patch.meta.value : token.meta
		const slot =
			patch.slot?.kind === 'clear'
				? undefined
				: patch.slot?.kind === 'set'
					? patch.slot.value
					: token.slot?.content
		const serialized = this.#serialize(token, {value, meta, slot})

		this.store.value.replace(token.position, serialized)
		return true
	}

	#serialize(token: MarkToken, fields: {value: string; meta?: string; slot?: string}): string {
		return annotate(token.descriptor.markup, {
			value: fields.value,
			meta: token.descriptor.gapTypes.includes('meta') ? (fields.meta ?? '') : undefined,
			slot: token.descriptor.hasSlot ? (fields.slot ?? '') : undefined,
		})
	}

	/** The live mark to mutate, or undefined in read-only mode / against a dead or mid-window handle. */
	#resolve(): MarkToken | undefined {
		if (this.store.props.readOnly()) return undefined
		return this.#liveMark()
	}
}