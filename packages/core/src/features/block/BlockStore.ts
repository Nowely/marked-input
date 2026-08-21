import {signal} from '../../shared/signals'
import type {DragAction, DragActions} from '../../shared/types'

type DropPosition = 'before' | 'after' | null

// Per-event-target overloads infer the correct event type per handler key
// (mouseenter → MouseEvent, dragover → DragEvent, etc.). Call sites stay
// strongly typed without explicit (e: DragEvent) annotations.
function wireListeners(
	target: HTMLElement,
	handlers: Partial<{[K in keyof HTMLElementEventMap]: (e: HTMLElementEventMap[K]) => void}>
): () => void
function wireListeners(
	target: Document,
	handlers: Partial<{[K in keyof DocumentEventMap]: (e: DocumentEventMap[K]) => void}>
): () => void
// oxlint-disable-next-line no-explicit-any -- impl signature must be wide enough to subsume both HTMLElementEventMap and DocumentEventMap handler shapes
function wireListeners(target: EventTarget, handlers: Record<string, (e: any) => void>): () => void {
	const entries = Object.entries(handlers)
	for (const [event, handler] of entries) target.addEventListener(event, handler)
	return () => {
		for (const [event, handler] of entries) target.removeEventListener(event, handler)
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
		const rect = el.getBoundingClientRect()
		this.state.dropPosition(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
	}

	#onContainerDragLeave(e: DragEvent) {
		const ct = e.currentTarget
		if (ct instanceof Node && ct.contains(e.relatedTarget instanceof Node ? e.relatedTarget : null)) return
		this.state.dropPosition(null)
	}

	#onContainerDrop(e: DragEvent) {
		if (!e.dataTransfer) return
		e.preventDefault()
		const sourceIndex = Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
		if (Number.isNaN(sourceIndex)) return
		const targetIndex =
			(this.state.dropPosition() ?? 'after') === 'before' ? this.#blockIndex : this.#blockIndex + 1
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
		if (!el.contains(e.target instanceof Node ? e.target : null)) this.closeMenu()
	}

	#onMenuKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') this.closeMenu()
	}

	#emit(action: DragAction) {
		this.#dragAction?.(action)
	}

	#emitAndClose(action: DragAction) {
		this.#emit(action)
		this.closeMenu()
	}
}