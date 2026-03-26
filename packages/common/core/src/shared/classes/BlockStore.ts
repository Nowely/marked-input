import {defineState, type StateObject, type UseHookFactory} from './defineState'

export type DropPosition = 'before' | 'after' | null

interface BlockState {
	isHovered: boolean
	isDragging: boolean
	dropPosition: DropPosition
	menuOpen: boolean
	menuPosition: {top: number; left: number}
}

export class BlockStore {
	readonly refs = {
		container: null as HTMLElement | null,
	}

	readonly state: StateObject<BlockState>

	constructor(createUseHook: UseHookFactory) {
		this.state = defineState<BlockState>(
			{
				isHovered: false,
				isDragging: false,
				dropPosition: null,
				menuOpen: false,
				menuPosition: {top: 0, left: 0},
			},
			createUseHook
		)
	}
}