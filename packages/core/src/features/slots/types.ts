import type {CoreOption, Slot} from '../../shared/types'
import type {RowNode, TreeNode} from '../tokens'
import type {RowGroup, RowRender} from './resolveSlot'

export interface NodeSlot {
	(): (node: TreeNode, row?: RowRender) => readonly [Slot, Record<string, unknown>]
}

export interface RowGroupSlot {
	(): (rows: readonly RowNode[]) => readonly RowGroup[]
}

export interface OverlaySlot {
	(): (option?: CoreOption, defaultComponent?: Slot) => readonly [Slot, Record<string, unknown>]
}