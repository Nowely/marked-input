import {signal} from '../../shared/signals'
import type {PropsModel} from '../state/PropsModel'
import type {TokenModel, TreeNode} from '../tokens'

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

	#cleanupContainer?: () => void
	#cleanupGrip?: () => void
	#cleanupMenu?: () => void

	constructor(
		private readonly node: TreeNode,
		private readonly props: PropsModel,
		private readonly tokens: TokenModel
	) {}

	attachContainer(el: HTMLElement | null) {
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

	attachGrip(el: HTMLButtonElement | null) {
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
	// A fresh row IS the separator (issue 08): spliced after the anchor row's own separator it
	// reads as an empty row, and on the document-final unterminated row it first terminates
	// that row.
	addBlock = () => this.#runMenuVerb(() => this.node.insertAfter(this.props.separator()))
	deleteBlock = () => this.#runMenuVerb(() => this.node.remove())
	duplicateBlock = () => this.#runMenuVerb(() => this.node.duplicate())

	/**
	 * The row's own node speaks, and saying so is what keeps the other rows' identity:
	 * composing a new whole document and diffing it back cannot tell two byte-identical rows
	 * apart, so the commit would announce the WRONG id as removed.
	 *
	 * `draggable` gates the DRAG UI (the grip's drag affordance), not these — menu and
	 * keyboard row edits are block-mode features, so block mode alone admits them. The menu
	 * closes either way, so a refused verb does not leave it open. The block check is carried
	 * over from the watch this replaced; on this path it is belt-and-braces, since a row node
	 * cannot survive a switch to inline layout and the transaction layer refuses a dead one.
	 */
	#runMenuVerb(verb: () => void) {
		if (this.props.layout.isBlock()) verb()
		this.closeMenu()
	}

	/**
	 * The row's live index. A READER, not a fed number: the store outlives renders, so a copy
	 * goes stale as soon as a row above it appears or disappears. During a drag the tree is
	 * static, so the live read equals what a render would have fed. `-1` for a node that has
	 * left the tree.
	 */
	#blockIndex(): number {
		return this.tokens.rootIndexOf(this.node.id) ?? -1
	}

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
		const source = Number.parseInt(e.dataTransfer.getData('text/plain'), 10)
		if (Number.isNaN(source)) return
		const index = this.#blockIndex()
		const target = (this.state.dropPosition() ?? 'after') === 'before' ? index : index + 1
		this.state.dropPosition(null)
		// Reorder is drag-originated, so unlike the menu verbs it stays behind `draggable`.
		// The block check is load-bearing here, unlike its belt-and-braces twin on the menu
		// path: the move addresses `nodes().at(source)`, not this store's own node, so a row
		// node that died with the layout refuses nothing for it. Outside block layout
		// `nodes()` holds the INLINE nodes, and the drop would reorder THOSE.
		if (!this.props.layout.isBlock() || !this.props.draggable()) return
		// `source` is whatever the drag carried, and this handler asks the payload for no
		// provenance — so it is not trusted to name a row. `Array.prototype.at` WRAPS on a
		// negative index, and an unguarded `at(-1)` would move the LAST row to the top.
		if (source < 0) return
		// The drop target names a SLOT BETWEEN rows, so a target below the source shifts down by
		// one once the row leaves its old place. Both drag no-ops — dropping on itself, and
		// dropping on its own trailing edge — collapse onto `to === from`, which `movePlan`
		// already refuses.
		const to = target > source ? target - 1 : target
		this.tokens.nodes().at(source)?.moveTo(to)
	}

	#onGripDragStart(e: DragEvent) {
		if (!e.dataTransfer) return
		e.dataTransfer.effectAllowed = 'move'
		e.dataTransfer.setData('text/plain', String(this.#blockIndex()))
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
}