import type {MarkToken} from '.'
import type {MarkPatch} from '../../shared/editorContracts'
import type {Store} from '../../store'
import {annotate} from './parser/utils/annotate'
import {joinNodes} from './tree/tree'
import type {MarkNode} from './tree/types'

/**
 * Id-backed mark command surface: the controller holds a stable token id and
 * resolves it against the LIVE tree (`store.tokens.find(id)`) on every access.
 *
 * Reads (`value`/`meta`/`slot`) are always fresh and need no fallback — the tree
 * has no pending window, where the latch-gated `handle(id)` served `undefined`
 * between a structural apply and its bind. A mark that has LEFT the tree reads as
 * empty (`''`/`undefined`) rather than resurrecting a construction-time copy.
 *
 * Writes (`update`/`remove`) fail closed in read-only mode and against a mark that
 * is no longer in the tree. They no longer fail closed mid-window: the write folds
 * into the pending structural pass (§4.6 item 4 retires the write latch).
 */
export class MarkController {
	constructor(
		private readonly store: Store,
		private readonly id: number
	) {}

	static fromToken(store: Store, token: MarkToken): MarkController {
		// The `captured` third argument goes: reads no longer need a fallback, because
		// `find(id)` has no pending window. The id check stays — a token with no id is
		// genuinely foreign.
		if (token.id === undefined) throw new Error('Cannot create MarkController for a token without an id')
		return new MarkController(store, token.id)
	}

	/** The live mark node at this id, or undefined once it leaves the tree. */
	#node(): MarkNode | undefined {
		const node = this.store.tokens.find(this.id)
		return node?.kind === 'mark' ? node : undefined
	}

	get value(): string {
		return this.#node()?.value() ?? ''
	}

	get meta(): string | undefined {
		return this.#node()?.meta()
	}

	/**
	 * Slot TEXT, derived. `MarkNode.slot` stores POSITIONS only — `tree/types.ts` is
	 * explicit that slot text is deliberately not stored ("a stored copy would be an
	 * unread mirror nothing resyncs"), so where the token had `slot?.content` ready-made
	 * the node needs the children joined. `undefined` for a markup with no slot, matching
	 * the token contract.
	 */
	get slot(): string | undefined {
		const node = this.#node()
		if (!node?.descriptor.hasSlot) return undefined
		return joinNodes(node.children())
	}

	get readOnly(): boolean {
		return this.store.props.readOnly()
	}

	remove(): boolean {
		const node = this.#resolve()
		if (!node) return false
		return this.store.tokens.applyStructural(node, '')
	}

	update(patch: MarkPatch): boolean {
		const node = this.#resolve()
		if (!node) return false

		// Patch defaults come off the NODE now, not off a handle's bind-generation token.
		const value = patch.value ?? node.value()
		const meta =
			patch.meta?.kind === 'clear' ? undefined : patch.meta?.kind === 'set' ? patch.meta.value : node.meta()
		const slot =
			patch.slot?.kind === 'clear'
				? undefined
				: patch.slot?.kind === 'set'
					? patch.slot.value
					: node.descriptor.hasSlot
						? joinNodes(node.children())
						: undefined

		return this.store.tokens.applyStructural(node, this.#serialize(node, {value, meta, slot}))
	}

	/** Unchanged except for its source: the descriptor now comes off the node. */
	#serialize(node: MarkNode, fields: {value: string; meta?: string; slot?: string}): string {
		return annotate(node.descriptor.markup, {
			value: fields.value,
			meta: node.descriptor.gapTypes.includes('meta') ? (fields.meta ?? '') : undefined,
			slot: node.descriptor.hasSlot ? (fields.slot ?? '') : undefined,
		})
	}

	/**
	 * ONE resolution now, where there were two. The latch-gated handle was the write
	 * PERMISSION check and the node was the write TARGET; §4.6 item 4 retires the
	 * permission, so only the target remains. Read-only still fails closed, and a mark
	 * that has left the tree still fails closed — `find(id)` misses.
	 */
	#resolve(): MarkNode | undefined {
		if (this.store.props.readOnly()) return undefined
		return this.#node()
	}
}