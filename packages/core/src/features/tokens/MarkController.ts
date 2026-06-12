import type {MarkToken} from '.'
import type {MarkPatch, MarkSnapshot, TokenAddress} from '../../shared/editorContracts'
import type {Store} from '../../store'
import {annotate} from './parser/utils/annotate'

export class MarkController {
	constructor(
		private readonly store: Store,
		private readonly address: TokenAddress,
		private readonly snapshot: MarkSnapshot
	) {}

	static fromToken(store: Store, token: MarkToken): MarkController {
		// Adapters hand in tokens from the reference-stable structure() tree,
		// which may be stale after text-path commits — bridge by identity to the
		// current address first. The index lookup remains for tokens that ARE
		// current (headless stores, first paint before any DOM commit).
		const address = store.tokens.freshAddressFor(token) ?? MarkController.#addressFromIndex(store, token)

		return new MarkController(store, address, {
			value: token.value,
			meta: token.meta,
			slot: token.slot?.content,
			readOnly: store.props.readOnly(),
		})
	}

	static #addressFromIndex(store: Store, token: MarkToken): TokenAddress {
		const index = store.tokens.index()
		const path = index.pathFor(token)
		if (!path) throw new Error('Cannot create MarkController for unindexed token')
		const address = index.addressFor(path)
		if (!address) throw new Error('Cannot create MarkController for unresolved token path')
		return address
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
		// survives object replacement and every commit refreshes the id → address
		// projection, so the bridge yields the CURRENT address — mutations hit
		// the shifted (correct) range. When the bridge cannot resolve (headless
		// store, identity gone), fall back to the captured address, where
		// resolveAddress's identity check keeps the fail-closed no-op semantics.
		const address = this.store.tokens.freshAddressFor(this.address.token) ?? this.address
		const resolved = this.store.tokens.index().resolveAddress(address)
		if (resolved?.type !== 'mark') return undefined
		return resolved
	}
}