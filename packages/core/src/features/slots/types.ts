import type {CoreOption, Slot} from '../../shared/types'
import type {TreeNode} from '../tokens'

export interface NodeSlot {
	(): (node: TreeNode) => readonly [Slot, Record<string, unknown>]
}

export interface OverlaySlot {
	(): (option?: CoreOption, defaultComponent?: Slot) => readonly [Slot, Record<string, unknown>]
}