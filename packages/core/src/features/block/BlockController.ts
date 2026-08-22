import type {PropsModel} from '../state/PropsModel'
import type {TokenModel, TreeNode} from '../tokens'
import {BlockStore} from './BlockStore'

export class BlockController {
	/**
	 * Per-row UI-state stores keyed by the row NODE. Object keying is exactly as stable
	 * as id keying here, and that is a property of adoption rather than a hope: a node's
	 * `id` is allocated once, inside `buildNode`, from a counter private to the one tree
	 * a `TokenModel` ever builds — so within an input instance an id is carried by one
	 * object forever, and "kept its id" and "kept its object" are the same statement.
	 * Adoption writes surviving nodes in place, so an edit above a row no longer
	 * re-materializes it (the pre-identity WeakMap predates that).
	 *
	 * Keying on the object also makes the map self-collecting, which is why there is no
	 * prune: a number-keyed Map could only shed a dead row on an announcement,
	 * and that announcement needs a mounted container — an unmounted or never-bound row
	 * leaked its store for the lifetime of the input.
	 */
	readonly #stores = new WeakMap<TreeNode, BlockStore>()

	constructor(
		private readonly props: PropsModel,
		private readonly tokens: TokenModel
	) {}

	/** Returns the per-row UI-state store for a row node, creating it on first access. */
	get(node: TreeNode): BlockStore {
		let store = this.#stores.get(node)
		if (!store) {
			store = new BlockStore(node, this.props, this.tokens)
			this.#stores.set(node, store)
		}
		return store
	}
}