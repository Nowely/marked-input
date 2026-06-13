import type {MarkToken, Token} from '.'
import type {MarkPatch, MarkSnapshot, TokenAddress, TokenPath} from '../../shared/editorContracts'
import type {Store} from '../../store'
import {annotate} from './parser/utils/annotate'
import {resolvePath} from './tokenIndex'

export class MarkController {
	constructor(
		private readonly store: Store,
		private readonly address: TokenAddress,
		private readonly snapshot: MarkSnapshot
	) {}

	static fromToken(store: Store, token: MarkToken): MarkController {
		// Adapters hand in tokens from the reference-stable tree(), which may be
		// stale after text-path commits — bridge by identity to the live handle
		// first. The tree walk remains for tokens that are current but unbound
		// (structural apply awaiting its bind, transient DOM misalignment).
		const address = store.tokens.handleOf(token)?.address() ?? MarkController.#addressInTree(store, token)

		return new MarkController(store, address, {
			value: token.value,
			meta: token.meta,
			slot: token.slot?.content,
			readOnly: store.props.readOnly(),
		})
	}

	static #addressInTree(store: Store, token: MarkToken): TokenAddress {
		const path = pathOf(store.tokens.tokens(), token)
		if (!path) throw new Error('Cannot create MarkController for a token outside the current tree')
		return {path, token}
	}

	get value(): string {
		return this.snapshot.value
	}

	get meta(): string | undefined {
		return this.snapshot.meta
	}

	get slot(): string | undefined {
		return this.snapshot.slot
	}

	get readOnly(): boolean {
		return this.snapshot.readOnly
	}

	remove() {
		const resolved = this.#resolve()
		if (!resolved) return
		this.store.value.replace(resolved.position, '')
	}

	update(patch: MarkPatch) {
		const resolved = this.#resolve()
		if (!resolved) return

		const token = resolved
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
	}

	#serialize(token: MarkToken, fields: {value: string; meta?: string; slot?: string}): string {
		return annotate(token.descriptor.markup, {
			value: fields.value,
			meta: token.descriptor.gapTypes.includes('meta') ? (fields.meta ?? '') : undefined,
			slot: token.descriptor.hasSlot ? (fields.slot ?? '') : undefined,
		})
	}

	#resolve(): MarkToken | undefined {
		if (this.store.props.readOnly()) return undefined
		// Identity bridge: this controller may have been captured before N
		// text-path commits (the adapter never re-rendered), leaving the captured
		// address with a stale token object and stale position. The token's id
		// survives object replacement and the node layer is refreshed by every
		// commit, so the handle yields the CURRENT token — mutations hit the
		// shifted (correct) range. When the bridge cannot resolve (identity gone,
		// or a structural apply awaiting its bind — handleOf's latch gate), fall
		// back to the captured address; its OBJECT-IDENTITY check against the
		// render tree keeps the fail-closed no-op semantics.
		const resolved = this.store.tokens.handleOf(this.address.token)?.token() ?? this.#resolveCaptured()
		if (resolved?.type !== 'mark') return undefined
		return resolved
	}

	#resolveCaptured(): Token | undefined {
		const current = resolvePath(this.store.tokens.tokens(), this.address.path)
		return current === this.address.token ? current : undefined
	}
}

/** Depth-first path of a token in the tree, by object identity. */
function pathOf(tokens: readonly Token[], target: Token, base: TokenPath = []): TokenPath | undefined {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === target) return [...base, i]
		if (token.type !== 'mark') continue
		const nested = pathOf(token.children, target, [...base, i])
		if (nested) return nested
	}
	return undefined
}