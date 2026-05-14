import type {DraggableConfig} from '../../shared/types'

export function getAlwaysShowHandle(draggable: boolean | DraggableConfig): boolean {
	return typeof draggable === 'object' && !!draggable.alwaysShowHandle
}