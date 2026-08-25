import type {CoreOption, Slot} from '../../shared/types'
import type {TreeNode} from '../tokens'
import type {RowRender} from './resolveSlot'

export interface NodeSlot {
	(): (node: TreeNode, row?: RowRender) => readonly [Slot, Record<string, unknown>]
}

export interface OverlaySlot {
	(): (option?: CoreOption, defaultComponent?: Slot) => readonly [Slot, Record<string, unknown>]
}