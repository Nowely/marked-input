import type {EditResult, MarkPatch, MarkSnapshot, TokenAddress, TokenShapeSnapshot} from '../../shared/editorContracts'
import type {Store} from '../../store'
import type {MarkToken} from '../parsing'
import {annotate} from '../parsing/parser/utils/annotate'
import {snapshotTokenShape} from '../parsing/tokenIndex'

export class MarkController {
	readonly #shape: TokenShapeSnapshot

	constructor(
		private readonly store: Store,
		private readonly address: TokenAddress,
		private readonly snapshot: MarkSnapshot,
		shape: TokenShapeSnapshot
	) {
		this.#shape = shape
	}

	static fromToken(store: Store, token: MarkToken): MarkController {
		const index = store.parsing.index()
		const path = index.pathFor(token)
		if (!path) throw new Error('Cannot create MarkController for unindexed token')
		const address = index.addressFor(path)
		if (!address) throw new Error('Cannot create MarkController for unresolved token path')

		return new MarkController(
			store,
			address,
			{
				value: token.value,
				meta: token.meta,
				slot: token.slot?.content,
				readOnly: store.props.readOnly(),
			},
			snapshotTokenShape(token)
		)
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

	remove(): EditResult {
		const resolved = this.#resolve()
		if (!resolved.ok) return resolved
		return this.store.value.replaceRange(resolved.value.position, '', {source: 'mark'})
	}

	update(patch: MarkPatch): EditResult {
		const resolved = this.#resolve()
		if (!resolved.ok) return resolved

		const token = resolved.value
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

		return this.store.value.replaceRange(token.position, serialized, {source: 'mark'})
	}

	#serialize(token: MarkToken, fields: {value: string; meta?: string; slot?: string}): string {
		return annotate(token.descriptor.markup, {
			value: fields.value,
			meta: token.descriptor.gapTypes.includes('meta') ? (fields.meta ?? '') : undefined,
			slot: token.descriptor.hasSlot ? (fields.slot ?? '') : undefined,
		})
	}

	#resolve(): {ok: true; value: MarkToken} | {ok: false; reason: 'stale' | 'readOnly'} {
		if (this.store.props.readOnly()) return {ok: false, reason: 'readOnly'}
		const resolved = this.store.parsing.index().resolveAddress(this.address, this.#shape)
		if (!resolved.ok || resolved.value.type !== 'mark') return {ok: false, reason: 'stale'}
		return {ok: true, value: resolved.value}
	}
}