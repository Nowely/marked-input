import {signal} from '../signals'
import type {DragAction, DragActions} from '../types'
import {getDragDropPosition, getDragTargetIndex, parseDragSourceIndex} from '../utils/dragUtils'
import {isClickOutside, isEscapeKey} from '../utils/menuUtils'

export type DropPosition = 'before' | 'after' | null

export class BlockStore {
	readonly refs = {
		container: null as HTMLElement | null,
	}

	readonly state = {
		isHovered: signal(false),
		isDragging: signal(false),
		dropPosition: signal<DropPosition>(null),
		menuOpen: signal(false),
		menuPosition: signal({top: 0, left: 0}),
	}

	#blockIndex = 0
	#dragAction: DragActions['dragAction'] | null = null
	#cleanupContainer?: () => void
	#cleanupGrip?: () => void
	#cleanupMenu?: () => void

	attachContainer(el: HTMLElement | null, blockIndex: number, actions: DragActions) {
		this.#blockIndex = blockIndex
		this.#dragAction = actions.dragAction
		if (el === this.refs.container) return
		this.#cleanupContainer?.()
		this.refs.container = el
		if (!el) return

		const onMouseEnter = () => this.state.isHovered.set(true)
		const onMouseLeave = () => this.state.isHovered.set(false)
		const onDragOver = (e: DragEvent) => {
			if (!e.dataTransfer) return
			e.preventDefault()
			e.dataTransfer.dropEffect = 'move'
			this.state.dropPosition.set(getDragDropPosition(e.clientY, el.getBoundingClientRect()))
		}
		const onDragLeave = (e: DragEvent) => {
			const ct = e.currentTarget
			if (ct instanceof Node && ct.contains(e.relatedTarget instanceof Node ? e.relatedTarget : null)) return
			this.state.dropPosition.set(null)
		}
		const onDrop = (e: DragEvent) => {
			if (!e.dataTransfer) return
			e.preventDefault()
			const sourceIndex = parseDragSourceIndex(e.dataTransfer)
			if (sourceIndex === null) return
			const targetIndex = getDragTargetIndex(this.#blockIndex, this.state.dropPosition.get() ?? 'after')
			this.state.dropPosition.set(null)
			this.#emit({type: 'reorder', source: sourceIndex, target: targetIndex})
		}

		el.addEventListener('mouseenter', onMouseEnter)
		el.addEventListener('mouseleave', onMouseLeave)
		el.addEventListener('dragover', onDragOver)
		el.addEventListener('dragleave', onDragLeave)
		el.addEventListener('drop', onDrop)
		this.#cleanupContainer = () => {
			el.removeEventListener('mouseenter', onMouseEnter)
			el.removeEventListener('mouseleave', onMouseLeave)
			el.removeEventListener('dragover', onDragOver)
			el.removeEventListener('dragleave', onDragLeave)
			el.removeEventListener('drop', onDrop)
		}
	}

	attachGrip(el: HTMLButtonElement | null, blockIndex: number, actions: DragActions) {
		this.#blockIndex = blockIndex
		this.#dragAction = actions.dragAction
		this.#cleanupGrip?.()
		if (!el) return

		const onDragStart = (e: DragEvent) => {
			if (!e.dataTransfer) return
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData('text/plain', String(this.#blockIndex))
			this.state.isDragging.set(true)
			if (this.refs.container) e.dataTransfer.setDragImage(this.refs.container, 0, 0)
		}
		const onDragEnd = () => {
			this.state.isDragging.set(false)
			this.state.dropPosition.set(null)
		}
		const onClick = (e: MouseEvent) => {
			e.preventDefault()
			const rect = el.getBoundingClientRect()
			this.state.menuPosition.set({top: rect.bottom + 4, left: rect.left})
			this.state.menuOpen.set(true)
		}

		el.addEventListener('dragstart', onDragStart)
		el.addEventListener('dragend', onDragEnd)
		el.addEventListener('click', onClick)
		this.#cleanupGrip = () => {
			el.removeEventListener('dragstart', onDragStart)
			el.removeEventListener('dragend', onDragEnd)
			el.removeEventListener('click', onClick)
		}
	}

	attachMenu(el: HTMLElement | null) {
		this.#cleanupMenu?.()
		if (!el) return

		const onMouseDown = (e: MouseEvent) => {
			if (isClickOutside(e.target, el)) this.closeMenu()
		}
		const onKeyDown = (e: KeyboardEvent) => {
			if (isEscapeKey(e)) this.closeMenu()
		}
		document.addEventListener('mousedown', onMouseDown)
		document.addEventListener('keydown', onKeyDown)
		this.#cleanupMenu = () => {
			document.removeEventListener('mousedown', onMouseDown)
			document.removeEventListener('keydown', onKeyDown)
		}
	}

	closeMenu = () => this.state.menuOpen.set(false)
	addBlock = () => {
		this.#emit({type: 'add', afterIndex: this.#blockIndex})
		this.closeMenu()
	}
	deleteBlock = () => {
		this.#emit({type: 'delete', index: this.#blockIndex})
		this.closeMenu()
	}
	duplicateBlock = () => {
		this.#emit({type: 'duplicate', index: this.#blockIndex})
		this.closeMenu()
	}

	#emit(action: DragAction) {
		this.#dragAction?.emit(action)
	}
}