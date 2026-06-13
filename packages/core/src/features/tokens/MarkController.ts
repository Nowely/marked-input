import type {MarkToken} from '.'
import type {MarkPatch} from '../../shared/editorContracts'
import type {Store} from '../../store'
import {annotate} from './parser/utils/annotate'

/**
 * Id-backed mark command surface. The controller holds a stable token id (not a
 * frozen `{address, snapshot}` capture and not an eager handle) plus the
 * render-tree token it was built from, used ONLY as a read fallback.
 *
 * Reads (`value`/`meta`/`slot`) prefer the LIVE handle: `store.tokens.handle(id)`
 * is re-resolved on every access, so they track text-path commits (and the
 * controller's own updates after re-bind) without re-capture. That id lookup is
 * latch-gated — it serves `undefined` while a structural apply awaits its bind
 * (the routine pending window hit on EVERY render before the freshly-painted DOM
 * binds). In that window a read falls back to the construction-time token, which
 * the adapter just handed in fresh for this very render: the rendered mark shows
 * its value immediately instead of flashing empty until a re-render that the
 * adapter never schedules.
 *
 * Writes (`update`/`remove`) stay strictly latch-gated: they resolve the LIVE
 * handle only and never act on the captured token (whose position can be a
 * generation stale). Against a pending (mid-window) or dead handle, or in
 * read-only mode, they are a fail-closed no-op returning `false`.
 */
export class MarkController {
	constructor(
		private readonly store: Store,
		private readonly id: number,
		private readonly captured: MarkToken
	) {}

	static fromToken(store: Store, token: MarkToken): MarkController {
		// The adapter hands in a render-tree token; bridge by its stable id (the
		// Phase-1 plain field) to the live handle on every read. A token with no id
		// is genuinely foreign — a real error. But an in-tree token whose handle is
		// not yet bound (the latch-gated mid-window, hit on every render before bind)
		// must NOT throw: construct the controller on the id and let reads fall back
		// to this token until the same-id handle binds and reads go live.
		if (token.id === undefined) throw new Error('Cannot create MarkController for a token without an id')
		return new MarkController(store, token.id, token)
	}

	/** The live mark token at this id, or undefined (dead, mid-window, or no longer a mark). */
	#liveMark(): MarkToken | undefined {
		// Re-resolve through the LATCH-GATED id lookup: handle(id) serves undefined
		// while a structural apply awaits its bind (the node layer is one generation
		// stale there) AND before the id's node has bound at all. A killed mark drops
		// out of the map entirely. Only a live, bound, still-mark handle yields a
		// token to mutate.
		const handle = this.store.tokens.handle(this.id)
		if (!handle || !handle.alive()) return undefined
		const token = handle.token()
		return token.type === 'mark' ? token : undefined
	}

	get value(): string {
		return (this.#liveMark() ?? this.captured).value
	}

	get meta(): string | undefined {
		return (this.#liveMark() ?? this.captured).meta
	}

	get slot(): string | undefined {
		return (this.#liveMark() ?? this.captured).slot?.content
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