import {effect, listen, signal, untracked, watch} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {RowConfig, TokenModel, TreeNode} from '../tokens'

/**
 * Which side of a row a drop lands on. Named `edge` rather than `position` on purpose:
 * ADR-0003's address-space check greps for `.position`, and a `drop.position` field trips it as
 * a false positive — dodging the word is cheaper than narrowing the gate.
 */
export type DropEdge = 'before' | 'after'

/** A row's geometry in the controls layer's own space: the container's PADDING box. */
export interface RowBox {
	top: number
	left: number
	width: number
	height: number
}

/**
 * THE Block layout owner: one hovered row, one dragged row, one drop edge and one open menu per
 * EDITOR, each addressed by row id.
 *
 * `*Controller`, not `*Model`, and the suffix is argued rather than assumed — it was contested
 * once and this paragraph exists so it is not contested again. The class DOES own state: five
 * signals, {@link menuElement} and the pin, and nothing else in core holds any of it. So does
 * `OverlayController`, whose shape this one copied down to the lazily attached,
 * interaction-scoped document listeners below. What separates the two suffixes HERE is DOM
 * lifecycle taken at MOUNT, and the rule is ONE-WAY — taking it forces `*Controller`; not taking
 * it forces nothing, which is why `EditController` is one with no listeners, no signals and no
 * mount hook at all. Measured across the whole population, no `*Model` in core takes a DOM
 * listener on mount: `PropsModel`, `DomModel` and `TokenModel` call `listen` zero times, and
 * `SuggestionsModel`'s one `container.addEventListener` sits in an opt-in `activate()` the
 * adapter calls and takes back, not in a mount hook. The decisive precedent is `TokenModel`: it
 * owns more state than anything else in core and pushed its DOM I/O OUT, into a class
 * deliberately not called `SelectionModel`. This one takes `host.onMounted`, installs five
 * container listeners plus two `ResizeObserver`s, a commit watch and a rAF loop there — two more
 * document listeners while a menu is open — and its menu and drop verbs write the TREE, which is
 * also what the per-row owner it replaced did. `store.block` names the concern, as every Store
 * field does.
 *
 * SAME NAME, DIFFERENT DESIGN — `git log` on this filename spans two of them. The earlier
 * `BlockController` vended a per-row `BlockStore` out of a `WeakMap` and pruned them by row id;
 * this one owns editor-level row-control state and there is no per-row store at all. The role is
 * the same — the controller of Block layout — so the name is, and `BlockStore` stays deleted.
 *
 * It replaced a per-row store that wired eight DOM handlers and five signals to every row, and
 * the adapters painted a grip, two drop indicators and a menu inside each one. The row controls
 * are not document content and they are not per-row state: at 200 rows that shape mounted 201
 * grip buttons, 201 control roots and 1608 listeners, where this attaches five listeners to the
 * container and the adapter paints one grip.
 *
 * The cost of moving out of the row is geometry. `.Block { position: relative }` made the grip
 * and the indicator free; a layer has to measure. Hit-testing is therefore a rect read per
 * mousemove, kept logarithmic by {@link rowAt}.
 *
 * BEHAVIOUR THIS CHANGES, all declared rather than absorbed:
 * - the row controls are addressed by POSITION, not by row identity (ADR-0007's 2026-08-22
 *   amendment);
 * - hover is geometric Y rather than DOM containment, so the 24px gutter left of a row hovers
 *   that row, and a point in the gap BETWEEN rows snaps to the nearest one.
 */
export class BlockController {
	readonly state = {
		hovered: signal<number | null>({initial: null}),
		dragging: signal<number | null>({initial: null}),
		// Shallow equality, so a dragover tick that lands on the same edge of the same row is
		// not a state change and re-renders nothing.
		drop: signal<{id: number; edge: DropEdge} | null>({initial: null, equals: shallow}),
		menu: signal<{id: number; top: number; left: number} | null>({initial: null, equals: shallow}),
		/** Bumped whenever row geometry may have moved; the layer re-measures off it. */
		geometry: signal({initial: 0}),
	}

	/**
	 * The open menu's own element, so the outside-mousedown dismissal below can tell inside from
	 * outside. ONE registration for the whole editor, where the per-row store took one per row.
	 */
	readonly menuElement = signal<HTMLElement | null>({initial: null})

	/**
	 * The hovered row, FROZEN for the duration of a grip press — see {@link frozen} for why drag
	 * does not work at all without it, and why nothing is attached to release it.
	 */
	#pinned = false

	constructor(
		private readonly host: Host,
		private readonly props: PropsModel,
		private readonly tokens: TokenModel
	) {
		host.onMounted(container => {
			listen(container, 'mousemove', e => {
				if (this.state.dragging() !== null || this.#frozen(e)) return
				this.state.hovered(this.rowAt(e.clientY)?.id ?? null)
			})
			listen(container, 'mouseleave', e => {
				if (this.state.dragging() === null && !this.#frozen(e)) this.state.hovered(null)
			})

			listen(container, 'dragover', e => this.#onDragOver(e))
			listen(container, 'dragleave', e => {
				const related = e.relatedTarget instanceof Node ? e.relatedTarget : null
				if (!container.contains(related)) this.state.drop(null)
			})
			listen(container, 'drop', e => this.#onDrop(e))

			// A rect measured at paint time goes stale the moment the document reflows, so the
			// layer is told to re-measure rather than handed a cache to invalidate. Two clocks,
			// and BOTH are needed:
			// - the container's own size, for a reflow the document did not cause (a window
			//   resize, a consumer animating the width);
			// - every commit, because a row that reflows moves every row BELOW it while the
			//   container's own box does not change at all. Inside a fixed-height
			//   `overflow: auto` consumer container — the shape `.Container { position:
			//   relative }` exists for — typing that wraps row 0 moved the grip off its row by
			//   the wrapped line's height and nothing told the layer.
			// A container `scroll` is deliberately NOT a clock: container-local coordinates
			// already carry `scrollTop`, so scrolling leaves every measured box identical.
			//
			// The container is observed on BOTH boxes, and one observer object each because
			// `observe()` REPLACES a target's existing observation rather than adding to it.
			// The layer's origin is the container's PADDING box, which a `ResizeObserver`
			// cannot observe, and neither surrogate sees a `padding-top` change on its own —
			// measured on the resting grip, pointer away, container padding 0 -> 60px:
			// - auto height, and fixed height under `content-box` sizing: 0 content-box
			//   callbacks, 1 border-box callback;
			// - fixed height under `border-box` sizing: the mirror image, 1 and 0.
			// Padding moves every row inside the box, so a single observation stranded the
			// resting grip by the full 60px in two of the three.
			effect(() => {
				const contentBox = new ResizeObserver(() => this.#moved())
				const borderBox = new ResizeObserver(() => this.#moved())
				contentBox.observe(container)
				borderBox.observe(container, {box: 'border-box'})
				return () => {
					contentBox.disconnect()
					borderBox.disconnect()
				}
			})
			watch(this.tokens.committed, () => this.#moved())
			this.#watchPaintedRows()

			// The menu's dismissal listeners live exactly as long as the menu does — the lazily
			// attached, interaction-scoped shape `OverlayController` already ships for its own
			// outside-click. A mounted editor with no menu open attaches nothing.
			effect(() => {
				const menu = this.state.menu()
				const element = this.menuElement()
				if (!menu || !element) return
				listen(document, 'mousedown', e => {
					if (!element.contains(e.target instanceof Node ? e.target : null)) this.closeMenu()
				})
				listen(document, 'keydown', e => {
					if (e.key === 'Escape') this.closeMenu()
				})
			})
		})
	}

	// ═══ Row-control verbs ═════════════════════════════════════════════════════

	/**
	 * Freeze the hovered row for the duration of the grip's press. Wired to the grip's own
	 * `mousedown`, and NOT to a container one: pinning on any container mousedown would freeze
	 * hover for the length of a text selection sweep.
	 */
	pinHover = (): void => {
		this.#pinned = true
	}

	/**
	 * `.Popup` is `position: fixed`, so the menu is the one row control that is NOT in the
	 * container's coordinate space — it takes viewport coordinates off the grip, exactly as the
	 * per-row menu did.
	 */
	openMenu(id: number, grip: DOMRect): void {
		this.state.menu({id, top: grip.bottom + 4, left: grip.left})
	}

	closeMenu = (): void => {
		this.state.menu(null)
	}

	// A fresh row IS the separator (issue 08): spliced after the anchor row's own separator it
	// reads as an empty row, and on the document-final unterminated row it first terminates
	// that row.
	addRow = (): void => this.#runMenuVerb((row, config) => row.insertAfter(config.separator))
	duplicateRow = (): void => this.#runMenuVerb(row => row.duplicate())
	deleteRow = (): void => this.#runMenuVerb(row => row.remove())

	/**
	 * `state.dragging` — not the payload — is what says a drop is this editor's own row,
	 * so `text/plain` is free to carry what a drag OUT of the editor should deliver: the row's
	 * own text, the same thing `ClipboardController`'s copy puts there and the same thing the
	 * drag image shows. It used to carry the row INDEX, which the drop handler read back.
	 */
	beginDrag(id: number, e: DragEvent): void {
		if (!e.dataTransfer) return
		e.dataTransfer.effectAllowed = 'move'
		this.state.dragging(id)
		// `setDragImage` needs the ROW element and reaches it through the same registry `bind`
		// reads — which is why the per-row store's `refs.container` needed no replacement here.
		const element = this.tokens.handle(id)?.element()
		e.dataTransfer.setData('text/plain', element?.textContent ?? '')
		if (element) e.dataTransfer.setDragImage(element, 0, 0)
	}

	endDrag(): void {
		// The drag path's pin release: Chromium delivers NO mouseup for a drag at all — measured
		// order is pointerdown, mousedown, dragstart, pointercancel, drop, dragend.
		this.#pinned = false
		this.state.dragging(null)
		this.state.drop(null)
	}

	// ═══ Geometry ══════════════════════════════════════════════════════════════

	/** A row's box in the layer's space, measured NOW; `undefined` for an unbound or unmounted row. */
	boxOf(id: number): RowBox | undefined {
		const element = this.tokens.handle(id)?.element()
		const container = this.#container()
		if (!element || !container) return undefined
		return toLocal(element.getBoundingClientRect(), container)
	}

	/**
	 * The row under a viewport Y, with the rect that answered it — `undefined` outside block
	 * layout, or when a row on the search path has no bound element.
	 *
	 * Rows tile the container vertically in tree order, so this is a BINARY search: the naive
	 * scan costs one rect read per row per mousemove tick. Measured at 10 reads/tick for 50 rows
	 * and 14 for 200 — ~12 µs/tick steady, ~38 µs/tick when a DOM write between ticks forces
	 * every read to reflow. Deliberately not cached per geometry tick: the worst measured case
	 * is 0.2% of a frame, and a cache would need invalidating by everything that can move a row,
	 * which is every commit and every re-wrapped line.
	 */
	rowAt(clientY: number): {id: number; rect: DOMRect} | undefined {
		if (this.tokens.rowConfig() === undefined) return undefined
		const rows = this.tokens.nodes()
		let low = 0
		let high = rows.length - 1
		let nearest: {id: number; rect: DOMRect} | undefined
		let nearestGap = Infinity
		while (low <= high) {
			const mid = (low + high) >> 1
			const id = rows[mid].id
			const element = this.tokens.handle(id)?.element()
			if (!element) return undefined
			const rect = element.getBoundingClientRect()
			if (clientY >= rect.top && clientY < rect.bottom) return {id, rect}
			// The nearest probe, not the LAST one: a search that ends by stepping past a gap
			// answers the FAR side of it. Tracking the closest is enough, because the search
			// cannot narrow onto a gap without probing both rows that bound it.
			const gap = clientY < rect.top ? rect.top - clientY : clientY - rect.bottom
			if (gap < nearestGap) {
				nearestGap = gap
				nearest = {id, rect}
			}
			if (clientY < rect.top) high = mid - 1
			else low = mid + 1
		}
		// Between two rows (a margin gap) or past the ends: the NEAREST row still owns the point.
		// DOM containment showed nothing there; this is the declared hover change.
		return nearest
	}

	// ─── internals ─────────────────────────────────────────────────────────────

	/** Untracked, so a caller reading geometry from inside an effect does not subscribe to mount. */
	#container(): HTMLElement | null {
		return untracked(() => this.host.container())
	}

	#moved(): void {
		this.state.geometry(untracked(() => this.state.geometry()) + 1)
	}

	/** The rows the layer is painting on right now — at most the grip's row and the drop edge's. */
	#paintedRows(): number[] {
		const grip = this.state.dragging() ?? this.state.hovered()
		const drop = this.state.drop()?.id
		const ids: number[] = []
		if (grip !== null) ids.push(grip)
		if (drop !== undefined && drop !== grip) ids.push(drop)
		return ids
	}

	/**
	 * The THIRD geometry clock, and the one neither of the other two can be: a row ABOVE the
	 * painted one reflowing with no commit and no container resize — an image or a webfont
	 * landing, a CSS animation finishing, a `details` opening inside a slot. It moves the painted
	 * row without changing its SIZE, so the container's observer and the adapters' observer on
	 * the painted row's own element both stay silent, and the pointer does not save it either:
	 * hover re-measures only when the hovered ROW changes, so a mousemove inside the same row
	 * leaves the drift exactly where it was. Measured in both adapters — fixed-height
	 * `overflow: auto` container, an animation growing row 0 by 66px while row 3 was hovered —
	 * the grip sat 66px off its row, over the row above it, and stayed there.
	 *
	 * It POLLS, because the platform has no "this element moved" event. The alternatives were
	 * measured rather than assumed:
	 * - a `ResizeObserver` on every row sees it, at 201 targets re-armed on every structural
	 *   commit at N=200 (measured: 1015 `observe()` calls over five commits) — the per-row cost
	 *   this layer exists to stop paying;
	 * - a `MutationObserver` on the container subtree sees NOTHING: the same reflow produced 0
	 *   records in both adapters, because an image, a font and an animation change layout
	 *   without touching the DOM;
	 * - re-measuring at paint time cannot help, because nothing repaints when a row moves;
	 * - a `ResizeObserver` on the container's CONTENT has no target — the scrollable content is
	 *   no element's box, and giving it one means a wrapper element inside the container, the
	 *   published DOM change this layer was placed inside the container to avoid.
	 *
	 * The cost is bounded by POINTER PRESENCE, not by the editor's lifetime — a pointer parked
	 * inside the editor keeps the loop alive, which is not a gesture. One rAF loop per editor,
	 * alive only while the controls are painted, reading two rects per painted row (the row's and the
	 * container's) and bumping the clock only when a box actually moved. Measured: 0.9 µs a frame
	 * with a clean layout, 20 µs when every read forces a reflow — 0.005% and 0.12% of a 16.7 ms
	 * frame — and 0 DOM writes over 300 ms of resting hover, because an unmoved box emits nothing.
	 * Two rect reads a frame at N=50 and two at N=200: {@link paintedRows} returns at most two ids
	 * by construction, so nothing here scales with the row count.
	 *
	 * WHAT IT DOES NOT COVER: `alwaysShowHandle` paints a grip on row 0 with the pointer AWAY, and
	 * this loop does not run then — {@link paintedRows} is hover and drag, so a RESTING grip is
	 * watched by no loop and never will be. It was once concluded from that that the resting grip
	 * had to drift; the container's padding case that proved it — 60px in both adapters — did not
	 * need frames at all, only the container's OTHER box, and is fixed above. What survives is
	 * narrower and needs no clock of its own: a reflow that moves row 0 while BOTH container boxes
	 * and row 0's own box keep their size. Two measured instances, and ordinary layout is enough
	 * for one of them — inside a fixed-height `overflow: auto` container, consumer content ABOVE
	 * the rows growing by 60px drifts the resting grip by 60 in both adapters; the same container
	 * under `display: flex; justify-content: center` drifts it by 30 when row 2 grows by 60. Both
	 * deliver 0 callbacks to all four observations. The pointer does not repair it either,
	 * because hover re-measures only when the hovered ROW changes and the resting row is already
	 * the hovered one. Covering it means these frames for the editor's whole lifetime whenever
	 * `alwaysShowHandle` is on — the permanent stream this design refuses — so it stays open.
	 */
	#watchPaintedRows(): void {
		effect(() => {
			const ids = this.#paintedRows()
			if (ids.length === 0) return
			// Measured inside the frame, never in the effect body: `boxOf` reads the DOM through
			// the token registry, and doing it here would make this effect a subscriber to it.
			let previous: (RowBox | undefined)[] | undefined
			let frame = 0
			const tick = (): void => {
				const last = previous
				const current = ids.map(id => this.boxOf(id))
				if (last && current.some((box, index) => !shallow(box, last[index]))) this.#moved()
				previous = current
				frame = requestAnimationFrame(tick)
			}
			frame = requestAnimationFrame(tick)
			return () => cancelAnimationFrame(frame)
		})
	}

	/**
	 * Is the hovered row frozen right now?
	 *
	 * THE PIN IS NOT OPTIONAL. Between the grip's mousedown and Chromium's `dragstart` the
	 * pointer travels a few pixels; an unpinned layer re-points the grip at whatever row that
	 * lands in, the grip walks out from under the pointer, and NO native drag event is produced
	 * at all. Inside the row this is structurally impossible — the grip moves with its own row.
	 *
	 * IT ATTACHES NOTHING TO RELEASE ITSELF. The pin is gesture state, so it expires with the
	 * gesture rather than with the editor: the only reader is a container mouse handler, and it
	 * clears the pin the first time it sees an event with no button held. A press that never
	 * becomes a drag and never releases inside the container therefore heals on re-entry instead
	 * of wedging the layer on the pressed row — measured with `draggable: false`: press the grip,
	 * leave the container, release on `BODY`, and both a container `mouseup` and a dragend-only
	 * release stay stuck on the pressed row forever. {@link endDrag} covers the drag path.
	 *
	 * The residual is that the pin can be STALE — `true` after the physical release, until the
	 * next container mouse event. Unobservable while this stays its only reader; a second reader
	 * that is not a container mouse handler would see a pin belonging to a gesture that ended.
	 */
	#frozen(e: MouseEvent): boolean {
		if (this.#pinned && e.buttons === 0) this.#pinned = false
		return this.#pinned
	}

	/**
	 * The row's own node speaks, and saying so is what keeps the other rows' identity: composing
	 * a new whole document and diffing it back cannot tell two byte-identical rows apart, so the
	 * commit would announce the WRONG id as removed.
	 *
	 * `draggable` gates the DRAG UI (the grip's drag affordance), not these — menu and keyboard
	 * row edits are row features, so a document with rows alone admits them. The menu closes
	 * either way, so a refused verb does not leave it open.
	 *
	 * The parse policy travels INTO the verb rather than being read again beside it: the gate
	 * below is what makes a separator available at all, and reading `props.separator` here would
	 * be a second answer to the question the gate just asked.
	 */
	#runMenuVerb(verb: (row: TreeNode, config: RowConfig) => void): void {
		const menu = this.state.menu()
		this.closeMenu()
		const config = this.tokens.rowConfig()
		if (!menu || config === undefined) return
		const row = this.tokens.find(menu.id)
		if (row) verb(row, config)
	}

	/**
	 * PROVENANCE, and it is the whole of the gate: a drag this editor did not start paints no
	 * drop edge, so `#onDrop` never claims it. The question "is this drag ours?" is asked of
	 * `state.dragging`, which only {@link beginDrag} — the grip's own `dragstart` — ever sets,
	 * and which is per-EDITOR by construction. Two editors on a page therefore
	 * discriminate each other for free, the same way `captureMarkupPaste` keeps two editors from
	 * consuming each other's clipboard: with per-container state, not with an id in the payload.
	 *
	 * The alternative was measured rather than argued. A private MIME type on the drag source
	 * works — real Chromium 151 keeps `application/x-markput-row+7` in `dataTransfer.types`
	 * through `dragenter`/`dragover`/`drop`, where protected mode makes `getData` answer `''`
	 * for every format, so `types` alone can decide at `dragover`. It was rejected because
	 * telling editors apart needs an id MINTED for this one purpose and shipped through the DOM,
	 * which is a second copy of a fact this class already owns — and because the copy can be the
	 * WRONG one: an editor remounted mid-drag would still match its own type while its tree, and
	 * therefore every row index in flight, is new.
	 */
	#onDragOver(e: DragEvent): void {
		if (!e.dataTransfer || this.state.dragging() === null) return
		const row = this.rowAt(e.clientY)
		if (!row) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
		const middle = row.rect.top + row.rect.height / 2
		this.state.drop({id: row.id, edge: e.clientY < middle ? 'before' : 'after'})
	}

	#onDrop(e: DragEvent): void {
		const drop = this.state.drop()
		const source = this.state.dragging()
		this.state.drop(null)
		// No painted drop edge means no `dragover` of ours accepted this drag, and cancelling it
		// would suppress the browser's own editable drop — measured: an unprevented `dragover`
		// still ends in `beforeinput`/`insertFromDrop` on a contenteditable, which is the event
		// `replacementForInput` already turns into an insert. So a FOREIGN drop over a row falls
		// through and inserts its text, in block layout exactly as in inline. The per-row handler
		// could not reach a foreign drop at all — it existed only on a row, in block layout —
		// where this one is on the container in EVERY layout, so the refusal has to be explicit.
		if (!drop || source === null) return
		e.preventDefault()
		// Reorder is drag-originated, so unlike the menu verbs it stays behind `draggable`. Only
		// a consumer flipping the prop mid-drag reaches this: the grip carries `draggable` too,
		// so with it off no `dragstart` fires and no drop edge is ever painted.
		if (!this.props.draggable()) return
		// Both ends resolve through the LIVE tree, and either answering `undefined` is what
		// refuses a drag whose layout left block mid-flight: the re-parse mints new ids, so
		// neither the dragged row nor the drop edge's row is a root any more.
		const from = this.tokens.rootIndexOf(source)
		const index = this.tokens.rootIndexOf(drop.id)
		if (from === undefined || index === undefined) return
		const target = drop.edge === 'before' ? index : index + 1
		// The drop target names a SLOT BETWEEN rows, so a target below the source shifts down by
		// one once the row leaves its old place. Both drag no-ops — dropping on itself, and
		// dropping on its own trailing edge — collapse onto the row's current index, which
		// `movePlan` already refuses.
		//
		// `{parent: null}`: {@link rowAt} hit-tests ROOTS alone, so a drop can only ever name a
		// root slot. Depth is a drop's to give once the hit test descends into nested rows.
		const row = this.tokens.find(source)
		if (row?.kind === 'row') row.moveTo({parent: null, index: target > from ? target - 1 : target})
	}
}

/**
 * A viewport rect in the layer's space. The layer is `position: absolute` inside the container,
 * so its containing block is the container's PADDING box: the border widths come off via
 * `clientTop`/`clientLeft`, and `left: 0` already sits at the outer edge of the 24px gutter.
 * `-24` would overshoot by exactly the gutter and be clipped away by an `overflow: auto`
 * consumer container.
 */
function toLocal(rect: DOMRect, container: HTMLElement): RowBox {
	const base = container.getBoundingClientRect()
	return {
		top: rect.top - base.top - container.clientTop + container.scrollTop,
		left: rect.left - base.left - container.clientLeft + container.scrollLeft,
		width: rect.width,
		height: rect.height,
	}
}