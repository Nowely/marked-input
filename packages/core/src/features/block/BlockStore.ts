import {signal} from '../../shared/signals'
import type {DragAction, DragActions} from '../../shared/types'
import {getDragDropPosition, getDragTargetIndex, parseDragSourceIndex} from '../../shared/utils/dragUtils'
import {isClickOutside, isEscapeKey} from '../../shared/utils/menuUtils'

export type DropPosition = 'before' | 'after' | null

type ListenerMap = Record<string, (e: Event) => void>

function wireListeners(target: EventTarget, handlers: ListenerMap): () => void {
	const entries = Object.entries(handlers)
	for (const [event, handler] of entries) target.addEventListener(event, handler as EventListener)
	return () => {
		for (const [event, handler] of entries) target.removeEventListener(event, handler as EventListener)
	}
}

export class BlockStore {
	readonly refs = {
		container: null as HTMLElement | null,
	}

	readonly state = {
		isHovered: signal({initial: false}),
		isDragging: signal({initial: false}),
		dropPosition: signal<DropPosition>({initial: null}),
		menuOpen: signal({initial: false}),
		menuPosition: signal({initial: {top: 0, left: 0}}),
	}

	#blockIndex = 0
	#dragAction: DragActions['action'] | null = null
	#cleanupContainer?: () => void
	#cleanupGrip?: () => void
	#cleanupMenu?: () => void

	attachContainer(el: HTMLElement | null, blockIndex: number, actions: DragActions) {
		this.#blockIndex = blockIndex
		this.#dragAction = actions.action
		if (el === this.refs.container) return
		this.#cleanupContainer?.()
		this.refs.container = el
		if (!el) return
		this.#cleanupContainer = wireListeners(el, {
			mouseenter: () => this.state.isHovered(true),
			mouseleave: () => this.state.isHovered(false),
			dragover: (e: DragEvent) => this.#onContainerDragOver(e, el),
			dragleave: (e: DragEvent) => this.#onContainerDragLeave(e),
			drop: (e: DragEvent) => this.#onContainerDrop(e),
		})
	}

	attachGrip(el: HTMLButtonElement | null, blockIndex: number, actions: DragActions) {
		this.#blockIndex = blockIndex
		this.#dragAction = actions.action
		this.#cleanupGrip?.()
		if (!el) return
		this.#cleanupGrip = wireListeners(el, {
			dragstart: (e: DragEvent) => this.#onGripDragStart(e),
			dragend: () => this.#onGripDragEnd(),
			click: (e: MouseEvent) => this.#onGripClick(e, el),
		})
	}

	attachMenu(el: HTMLElement | null) {
		this.#cleanupMenu?.()
		if (!el) return
		this.#cleanupMenu = wireListeners(document, {
			mousedown: (e: MouseEvent) => this.#onMenuOutsideMouseDown(e, el),
			keydown: (e: KeyboardEvent) => this.#onMenuKeyDown(e),
		})
	}

	closeMenu = () => this.state.menuOpen(false)
	addBlock = () => this.#emitAndClose({type: 'add', afterIndex: this.#blockIndex})
	deleteBlock = () => this.#emitAndClose({type: 'delete', index: this.#blockIndex})
	duplicateBlock = () => this.#emitAndClose({type: 'duplicate', index: this.#blockIndex})

	#onContainerDragOver(e: DragEvent, el: HTMLElement) {
		if (!e.dataTransfer) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
		this.state.dropPosition(getDragDropPosition(e.clientY, el.getBoundingClientRect()))
	}

	#onContainerDragLeave(e: DragEvent) {
		const ct = e.currentTarget
		if (ct instanceof Node && ct.contains(e.relatedTarget instanceof Node ? e.relatedTarget : null)) return
		this.state.dropPosition(null)
	}

	#onContainerDrop(e: DragEvent) {
		if (!e.dataTransfer) return
		e.preventDefault()
		const sourceIndex = parseDragSourceIndex(e.dataTransfer)
		if (sourceIndex === null) return
		const targetIndex = getDragTargetIndex(this.#blockIndex, this.state.dropPosition() ?? 'after')
		this.state.dropPosition(null)
		this.#emit({type: 'reorder', source: sourceIndex, target: targetIndex})
	}

	#onGripDragStart(e: DragEvent) {
		if (!e.dataTransfer) return
		e.dataTransfer.effectAllowed = 'move'
		e.dataTransfer.setData('text/plain', String(this.#blockIndex))
		this.state.isDragging(true)
		if (this.refs.container) e.dataTransfer.setDragImage(this.refs.container, 0, 0)
	}

	#onGripDragEnd() {
		this.state.isDragging(false)
		this.state.dropPosition(null)
	}

	#onGripClick(e: MouseEvent, el: HTMLElement) {
		e.preventDefault()
		const rect = el.getBoundingClientRect()
		this.state.menuPosition({top: rect.bottom + 4, left: rect.left})
		this.state.menuOpen(true)
	}

	#onMenuOutsideMouseDown(e: MouseEvent, el: HTMLElement) {
		if (isClickOutside(e.target, el)) this.closeMenu()
	}

	#onMenuKeyDown(e: KeyboardEvent) {
		if (isEscapeKey(e)) this.closeMenu()
	}

	#emit(action: DragAction) {
		this.#dragAction?.(action)
	}

	#emitAndClose(action: DragAction) {
		this.#emit(action)
		this.closeMenu()
	}
}