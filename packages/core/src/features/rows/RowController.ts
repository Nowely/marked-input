import {computed, effect, listen, signal, untracked, watch} from '../../shared/signals'
import type {Computed} from '../../shared/signals'
import {shallow} from '../../shared/utils/shallow'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import {hasCells} from '../tokens'
import type {RowNode, RowPlacement, TokenModel, TreeNode} from '../tokens'

/** One answer of {@link RowController.rowAt}'s search: which row, its box, and whether it HOLDS the point. */
type Hit = {id: number; rect: DOMRect; contained: boolean}

/**
 * A RESOLVED DROP: where the rows in flight will land, and the line the layer paints to say so.
 * ONE fact, so what is painted and what will happen cannot disagree — the placement is the one
 * the mover already accepted, and `line` is where its DEPTH puts the indicator.
 */
export interface DropTarget {
	readonly placement: RowPlacement
	readonly line: DropLine
}

/** The drop indicator's own geometry, in the layer's space. It has no height: it is a boundary. */
export interface DropLine {
	top: number
	left: number
	width: number
}

/** A row's geometry in the controls layer's own space: the container's PADDING box. */
export interface RowBox {
	top: number
	left: number
	width: number
	height: number
}

/**
 * The indent unit assumed when the document has NO nesting to measure — one grip gutter, which is
 * the only horizontal unit core owns. Reached exactly when the pointer is choosing between depth 0
 * and depth 1 in a flat document, where no painted parent/child pair exists to read one off.
 */
const ASSUMED_INDENT = 24

/**
 * THE row-controls owner: one hovered row, one dragged row, one RESOLVED DROP and one open menu
 * per EDITOR, each addressed by row id — plus {@link selected}, the row selection, which is
 * derived rather than held.
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
 * also what the per-row owner it replaced did. `store.rows` names the concern, as every Store
 * field does.
 *
 * It replaced a per-row store that wired eight DOM handlers and five signals to every row, and
 * the adapters painted a grip, two drop indicators and a menu inside each one. The row controls
 * are not document content and they are not per-row state: at 200 rows that shape mounted 201
 * grip buttons, 201 control roots and 1608 listeners, where this attaches five listeners to the
 * container and the adapter paints one grip.
 *
 * The cost of moving out of the row is geometry. `.Row { position: relative }` made the grip
 * and the indicator free; a layer has to measure. Hit-testing is therefore a rect read per
 * mousemove, kept logarithmic by {@link rowAt}.
 *
 * BEHAVIOUR THIS CHANGES, all declared rather than absorbed:
 * - the row controls are addressed by POSITION, not by row identity (ADR-0007's 2026-08-22
 *   amendment);
 * - hover is geometric Y rather than DOM containment, so the 24px gutter left of a row hovers
 *   that row, and a point in the gap BETWEEN rows snaps to the nearest one.
 *
 * The two earlier designs `git log` on this file spans, and the names they went by, are in this
 * feature's README. They are a record and not this class, and this docblock SHIPS — it is what a
 * consumer hovering `store.rows` reads out of the published `index.d.ts`.
 */
export class RowController {
	readonly state = {
		hovered: signal<number | null>({initial: null}),
		dragging: signal<number | null>({initial: null}),
		// Its own equality, because the value is two levels deep and `shallow` would call every
		// dragover tick a change: a tick resolving to the same placement AND the same painted line
		// is not a state change and re-renders nothing.
		drop: signal<DropTarget | null>({
			initial: null,
			equals: (a, b) => shallow(a?.placement, b?.placement) && shallow(a?.line, b?.line),
		}),
		menu: signal<{id: number; top: number; left: number} | null>({initial: null, equals: shallow}),
		/** Bumped whenever row geometry may have moved; the layer re-measures off it. */
		geometry: signal({initial: 0}),
	}

	/**
	 * THE ROW SELECTION: the rows the current selection covers WHOLE, maximal, in document order.
	 *
	 * DERIVED, and that is the design rather than an economy. A second store of selected row ids
	 * would need pruning on every commit, re-pairing across every adoption and reconciling with
	 * the caret — three clocks for a fact the selection already carries. Here a row is selected
	 * exactly while the text selection spans it, so Esc, Shift+arrows and Mod+A are all ONE
	 * `select` call and the DOM shows the selection for free.
	 *
	 * Its two dependencies are read TRACKED and neither is optional: `nodes()` moves when a commit
	 * re-parents a row, and `anchors()` moves when the selection does. The answer is then computed
	 * untracked inside {@link TokenModel.rowSelection}, because a row's coordinates are plain fields
	 * no signal covers.
	 */
	readonly selected: Computed<readonly number[]> = computed(
		() => {
			void this.tokens.nodes()
			const anchors = this.tokens.selection.anchors()
			if (!anchors || this.tokens.rowConfig() === undefined) return []
			return this.tokens.rowSelection(anchors).map(row => row.id)
		},
		{equals: shallow}
	)

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

	// The DEPTH the new row opens at is the row verb's, not a string this layer builds: the lead it
	// needs and the side of the separator it goes on are both facts of the tree (ADR-0003).
	addRow = (): void => this.#runMenuVerb(row => row.kind === 'row' && row.addSibling())
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

	/**
	 * MOVE THE ROWS THIS EDITOR IS ACTING ON to `placement`, in ONE splice — see {@link acting} for
	 * which rows those are, and `TokenModel.moveRows` for why a set cannot be a loop over the
	 * single-row verb.
	 *
	 * The drop calls it and so may a consumer; there is exactly one mover behind both, and the set
	 * is normalized to maximal subtrees inside the plan.
	 */
	move(placement: RowPlacement): boolean {
		return this.tokens.moveRows(this.#acting(), placement)
	}

	// ═══ Geometry ══════════════════════════════════════════════════════════════

	/**
	 * A row's OWN LINE in the layer's space, measured NOW; `undefined` for an unbound or unmounted
	 * row.
	 *
	 * THE OWN LINE, not the element's box, and the difference is the whole of nesting: a parent's
	 * element ENCLOSES its children, so its box is the subtree's. The layer's one painting consumer
	 * is the grip band, and a band the height of a subtree centres its 24px button on the SUBTREE's
	 * midpoint — 14 of those pixels landed on the child's line, where aiming at the grip flipped
	 * hover onto the child and the menu's Delete removed a row nobody pointed at. The own line is
	 * what `rowAt` already resolves the pointer against ("the parent's own LINE is what is left over
	 * once no child claims the point"), so this is the same boundary read from above.
	 *
	 * A CARVED row is a leaf here for `rowAt`'s reason: its children are cells laid out ACROSS the
	 * line, not under it, so none of them bounds the line from below.
	 */
	boxOf(id: number): RowBox | undefined {
		const element = this.tokens.handle(id)?.element()
		const container = this.#container()
		if (!element || !container) return undefined
		const rect = element.getBoundingClientRect()
		return {...toLocal(rect, container), height: this.#ownLineHeight(id, rect)}
	}

	/**
	 * How far a row's own line reaches down: to its first PAINTED child row, else to the end of
	 * its own element. A collapsed subtree paints none, so a closed toggle keeps its whole box —
	 * which is its own line anyway. A non-positive answer means a consumer's layout put the child
	 * beside or above the line rather than under it, and there the element's own box is the only
	 * reading left.
	 */
	#ownLineHeight(id: number, rect: DOMRect): number {
		const row = this.tokens.find(id)
		if (row?.kind !== 'row' || hasCells(row)) return rect.height
		for (const child of row.rows()) {
			const childRect = this.#rectOf(child.id)
			if (!childRect) continue
			const own = childRect.top - rect.top
			return own > 0 ? own : rect.height
		}
		return rect.height
	}

	/**
	 * The row under a viewport Y, with the rect that answered it — `undefined` where the document
	 * has no rows and for a document whose rows are none of them painted.
	 *
	 * TWO SEARCHES, because nesting takes the flat one's only sorted axis away: a parent's box
	 * CONTAINS its children's, so the roots still tile the container vertically in tree order
	 * ({@link hitAmong}'s binary search) while the row actually under the pointer is the DEEPEST
	 * one whose box holds it. The descent is the same search run over the hit row's own child rows
	 * — the parent's own LINE is what is left over once no child claims the point.
	 *
	 * The binary search is what keeps it logarithmic: the naive scan costs one rect read per row
	 * per mousemove tick. Measured at 10 reads/tick for 50 rows and 14 for 200 — ~12 µs/tick
	 * steady, ~38 µs/tick when a DOM write between ticks forces every read to reflow. Deliberately
	 * not cached per geometry tick: the worst measured case is 0.2% of a frame, and a cache would
	 * need invalidating by everything that can move a row, which is every commit and every
	 * re-wrapped line. The descent adds one search per LEVEL, over child lists rather than over the
	 * document.
	 *
	 * A CARVED row is a leaf here: its child rows are its own cells, a cell has no line of its own
	 * and no verb can address one, so pointing at a table's line answers the LINE.
	 *
	 * THE NEAREST FALLBACK IS ROOT-ONLY. At the top a point in the gap between two rows belongs to
	 * the nearer of them — the declared hover rule — but inside a parent the leftover space IS the
	 * parent's own line, so a nearest child there would claim a point the parent owns.
	 *
	 * A POINT PAST A ROOT'S BOX IS PAST ITS WHOLE SUBTREE, and answering the root there names the
	 * wrong line: a parent's box starts at its own line, so "after that line" is the slot its FIRST
	 * CHILD occupies and a drop below the document landed ABOVE rows the pointer was visibly below.
	 * The answer is the subtree's last painted line, reached by taking the last painted child at
	 * every level — which is also the nearest painted row to a point below everything, so hover
	 * lands where the pointer is.
	 */
	rowAt(clientY: number): {id: number; rect: DOMRect; depth: number; parent: DOMRect | undefined} | undefined {
		if (this.tokens.rowConfig() === undefined) return undefined
		let found = this.#hitAmong(this.tokens.nodes(), clientY)
		// The two by-products of the descent, and they are here because they are FREE here: a drop
		// reads the pointer's horizontal position in indent units, which needs the hit row's depth
		// and one measured indent step. Asked separately, each would be a second walk.
		let depth = 0
		let parent: DOMRect | undefined
		while (found?.contained === true) {
			const row = this.tokens.find(found.id)
			if (row?.kind !== 'row' || hasCells(row)) break
			const deeper = this.#hitAmong(row.rows(), clientY)
			if (deeper?.contained !== true) break
			parent = found.rect
			found = deeper
			depth++
		}
		while (found?.contained === false && clientY >= found.rect.bottom) {
			const row = this.tokens.find(found.id)
			if (row?.kind !== 'row' || hasCells(row)) break
			const kids = row.rows()
			// The same outward probe the search uses, aimed at the END of the level: a collapsed
			// subtree has no last painted line, and the descent stops at the row above it.
			const last = kids.length === 0 ? undefined : this.#paintedNear(kids, kids.length - 1, 0, kids.length - 1)
			if (!last) break
			parent = found.rect
			found = {id: kids[last.at].id, rect: last.rect, contained: false}
			depth++
		}
		return found && {id: found.id, rect: found.rect, depth, parent}
	}

	// ─── internals ─────────────────────────────────────────────────────────────

	/**
	 * The binary search itself, over ONE sibling list: the row whose box holds `clientY`, or the
	 * nearest probed row when the point falls in a gap between two.
	 *
	 * `contained` is the difference the descent needs and the flat search never had to state — see
	 * {@link rowAt} for why only the root level may take the nearest answer.
	 */
	#hitAmong(rows: readonly {id: number}[], clientY: number): Hit | undefined {
		let low = 0
		let high = rows.length - 1
		let nearest: Hit | undefined
		let nearestGap = Infinity
		while (low <= high) {
			const probe = this.#paintedNear(rows, (low + high) >> 1, low, high)
			// Nothing left in the range has a box — a collapsed subtree is the whole of this case.
			if (!probe) return nearest
			const {at, rect} = probe
			const id = rows[at].id
			if (clientY >= rect.top && clientY < rect.bottom) return {id, rect, contained: true}
			// The nearest probe, not the LAST one: a search that ends by stepping past a gap
			// answers the FAR side of it. Tracking the closest is enough, because the search
			// cannot narrow onto a gap without probing both rows that bound it.
			const gap = clientY < rect.top ? rect.top - clientY : clientY - rect.bottom
			if (gap < nearestGap) {
				nearestGap = gap
				nearest = {id, rect, contained: false}
			}
			if (clientY < rect.top) high = at - 1
			else low = at + 1
		}
		return nearest
	}

	/**
	 * THE COLLAPSE HAZARD, and this is the whole of the answer: a row hidden by a collapsed
	 * ancestor is still in the tree and still bound, so a search meets it — and it has no box to
	 * compare against, while a binary search cannot order by a coordinate that does not exist.
	 * Probing outward from `mid` to the nearest PAINTED row keeps the range's order intact, and
	 * costs nothing at all while every row is painted, which is the ordinary document.
	 *
	 * The collapsed shape is the cheap one by construction: a collapsed row hides its WHOLE child
	 * list, so the first probe walks the level, finds nothing and the descent stops at the row the
	 * consumer collapsed — which is the row a drop should land beside anyway.
	 */
	#paintedNear(
		rows: readonly {id: number}[],
		mid: number,
		low: number,
		high: number
	): {at: number; rect: DOMRect} | undefined {
		const probe = (at: number): {at: number; rect: DOMRect} | undefined => {
			if (at < low || at > high) return undefined
			const rect = this.#rectOf(rows[at].id)
			return rect && {at, rect}
		}
		for (let step = 0; step <= high - low; step++) {
			const before = probe(mid - step)
			if (before) return before
			const after = step > 0 ? probe(mid + step) : undefined
			if (after) return after
		}
		return undefined
	}

	/**
	 * A row's viewport box, or `undefined` when the row is not PAINTED. `getClientRects()` is empty
	 * exactly for an element layout produced no box for, which is what `hidden`/`display: none`
	 * makes of a collapsed row's children; `getBoundingClientRect()` alone answers all zeros there
	 * and cannot be told apart from a real box at the viewport origin.
	 */
	#rectOf(id: number): DOMRect | undefined {
		const element = this.tokens.handle(id)?.element()
		if (!element || element.getClientRects().length === 0) return undefined
		return element.getBoundingClientRect()
	}

	/** Untracked, so a caller reading geometry from inside an effect does not subscribe to mount. */
	#container(): HTMLElement | null {
		return untracked(() => this.host.container())
	}

	#moved(): void {
		this.state.geometry(untracked(() => this.state.geometry()) + 1)
	}

	/**
	 * The rows the layer is painting on right now — the grip's row, and nothing else.
	 *
	 * It used to be two, the drop edge's row with it, because the layer measured that row's box at
	 * paint time and a reflow underneath it stranded the indicator. The drop RESOLVES its own line
	 * now ({@link state.drop} carries it), and a live drag re-resolves on every `dragover` tick, so
	 * a moving row is re-measured by the gesture itself.
	 */
	#paintedRows(): number[] {
		const grip = this.state.dragging() ?? this.state.hovered()
		return grip === null ? [] : [grip]
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
	 * Two rect reads a frame at N=50 and two at N=200 — the painted row's own box and the
	 * container's: {@link paintedRows} returns at most ONE id by construction, so nothing here
	 * scales with the row count.
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
	 * The parse policy is a GATE and no longer a parameter: every verb below reads what it needs
	 * off the tree, and handing one this layer's reading of the separator would be a second answer
	 * to the question the gate just asked.
	 */
	#runMenuVerb(verb: (row: TreeNode) => void): void {
		const menu = this.state.menu()
		this.closeMenu()
		if (!menu || this.tokens.rowConfig() === undefined) return
		const row = this.tokens.find(menu.id)
		if (row) verb(row)

		// AND THE EDITOR TAKES ITS FOCUS BACK. The grip is a `<button>` inside the container, so
		// after a menu click `document.activeElement` is the grip — which is a registered control
		// root, and the whole keydown tier declines for one (`isConsumerKeyOrigin`). Every key the
		// user pressed next went nowhere: the `Mod+Z` after a Delete was a dead key, and the `X`
		// after an Add below landed in no row. The entry existed and the row existed; only focus
		// was in the wrong place, and a click back into the text made both work.
		//
		// AFTER the verb, so the caret it named is already stored and the driver's own placement
		// wins over whatever `focus()` would otherwise leave. Unconditional, because the guard that
		// would read naturally here — "focus is already inside the host" — is TRUE of the grip.
		untracked(() => this.host.container())?.focus()
	}

	/**
	 * PROVENANCE, and it is the whole of the gate: a drag this editor did not start paints no
	 * drop line, so `#onDrop` never claims it. The question "is this drag ours?" is asked of
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
		const target = this.#resolveDrop(e.clientX, e.clientY)
		// CLAIMED WHETHER OR NOT A PLACEMENT RESOLVED, and `dropEffect` is what says which: our own
		// row must never fall through to the browser's editable drop, which would insert the row's
		// own text into the document it is being dragged inside. A pointer over a gap that offers
		// this drag nothing gets `'none'`, so the browser paints a no-drop cursor and cancels the
		// gesture rather than being told a lie about what a release will do.
		e.preventDefault()
		e.dataTransfer.dropEffect = target ? 'move' : 'none'
		this.state.drop(target ?? null)
	}

	#onDrop(e: DragEvent): void {
		const drop = this.state.drop()
		const source = this.state.dragging()
		this.state.drop(null)
		// No drag of OURS means no `dragover` of ours accepted this one, and cancelling it would
		// suppress the browser's own editable drop — measured: an unprevented `dragover` still ends
		// in `beforeinput`/`insertFromDrop` on a contenteditable, which is the event
		// `replacementForInput` already turns into an insert. So a FOREIGN drop over a row falls
		// through and inserts its text, in a document with rows exactly as in one without. The per-row handler
		// could not reach a foreign drop at all — it existed only on a row —
		// where this one is on the container in EVERY layout, so the refusal has to be explicit.
		if (source === null) return
		e.preventDefault()
		if (!drop) return
		// Reorder is drag-originated, so unlike the menu verbs it stays behind `draggable`. Only
		// a consumer flipping the prop mid-drag reaches this: the grip carries `draggable` too,
		// so with it off no `dragstart` fires and no drop line is ever painted.
		if (!this.props.draggable()) return
		// THE PLACEMENT IS NOT RE-RESOLVED, and that is what makes the indicator a promise: it is the
		// one `dragover` already had the mover accept, off coordinates this event does not carry.
		// The SET is read again — `move` asks {@link acting}, which resolves every id through the
		// live tree — and that is the liveness check rather than a second opinion: a drag whose
		// document lost its rows mid-flight meets a re-parse that minted new ids, resolves none of them,
		// and hands the mover an empty set.
		this.move(drop.placement)
	}

	/**
	 * THE DROP, RESOLVED: which gap the pointer's Y names, which of that gap's legal depths its X
	 * chooses, and where the indicator goes to say so.
	 *
	 * The gap comes from the hit row's own LINE and not its box, and nesting is the whole reason:
	 * a parent's box covers its subtree, so its lower half is its children rather than its own
	 * trailing edge. Above the line's middle is the gap before the row; below it is the gap after
	 * that line — which, for a row that has children, is the slot its FIRST CHILD occupies.
	 *
	 * The depth is the pointer's horizontal position against the candidates the tree offers,
	 * measured in indent units off the hit row's own left edge: the deepest candidate whose left
	 * edge the pointer has reached, and the shallowest when it has reached none. The candidates
	 * themselves are the mover's answer, not this layer's guess.
	 */
	#resolveDrop(clientX: number, clientY: number): DropTarget | undefined {
		const moved = this.#acting()
		if (moved.length === 0) return undefined
		const hit = this.rowAt(clientY)
		const container = this.#container()
		if (!hit || !container) return undefined
		const row = this.tokens.find(hit.id)
		if (row?.kind !== 'row') return undefined

		const lineBottom = this.#lineBottom(row, hit.rect)
		const edge = clientY < (hit.rect.top + lineBottom) / 2 ? 'before' : 'after'
		const candidates = this.tokens.dropPlacements(moved, row, edge)
		if (candidates.length === 0) return undefined

		const step = this.#indentStep(row, hit.rect, hit.parent)
		let picked = candidates[0]
		for (const candidate of candidates) {
			if (clientX >= hit.rect.left + (candidate.depth - hit.depth) * step) picked = candidate
		}

		const box = toLocal(hit.rect, container)
		const left = box.left + (picked.depth - hit.depth) * step
		return {
			placement: picked.placement,
			line: {
				top: edge === 'before' ? box.top : box.top + (lineBottom - hit.rect.top),
				left,
				// The indicator starts where the dropped row will start, so it stops at the row's
				// right edge rather than keeping the row's full width from an indented origin.
				width: Math.max(0, box.width - (left - box.left)),
			},
		}
	}

	/**
	 * THE ROWS A VERB HERE ACTS ON: the row selection, or the gripped row alone when a drag started
	 * outside it.
	 *
	 * THE DRAG'S RULE, and only the drag's: the menu verbs act on the row their menu was opened on,
	 * which {@link runMenuVerb} resolves from `state.menu` alone. Picking up a row that is NOT part
	 * of the selection drags that row and nothing else — the alternative, rewriting the text
	 * selection on `dragstart`, moves the caret inside a live native drag for a fact the layer can
	 * simply read.
	 *
	 * Resolving each id through the LIVE tree is also the liveness check: a re-parse mid-drag mints
	 * new ids, so the set empties and every verb behind it fails closed.
	 */
	#acting(): RowNode[] {
		const source = this.state.dragging()
		const selected = this.selected()
		const ids = source !== null && !selected.includes(source) ? [source] : selected
		return ids.map(id => this.tokens.find(id)).filter((node): node is RowNode => node?.kind === 'row')
	}

	/**
	 * Where the hit row's OWN LINE ends: its first painted child row's top, or its own bottom when
	 * it has none. Derived from the boxes rather than from a DOM shape core does not own — a row's
	 * line is exactly the part of its box no child covers.
	 *
	 * A CARVED row's children are its own body, so its whole box is its line.
	 */
	#lineBottom(row: RowNode, rect: DOMRect): number {
		if (hasCells(row)) return rect.bottom
		for (const child of row.rows()) {
			const box = this.#rectOf(child.id)
			if (box) return box.top
		}
		return rect.bottom
	}

	/**
	 * The horizontal indent unit, MEASURED off the document rather than assumed: a nested row's box
	 * is inset from its parent's by exactly one level of whatever indentation the consumer paints,
	 * so the depth a pointer is asking for is readable without core knowing a single CSS rule.
	 *
	 * Two pairs, in the order they are reliable. The hit row and the PARENT the descent came
	 * through is the first — a leaf row is what a pointer usually lands on, and a leaf has no
	 * children to measure against. Its own first painted child is the second, for a hit at depth 0.
	 * {@link ASSUMED_INDENT} covers the one case with neither: a root row with no painted children,
	 * where the only choice the X makes is between depth 0 and depth 1.
	 */
	#indentStep(row: RowNode, rect: DOMRect, parent: DOMRect | undefined): number {
		if (parent && rect.left > parent.left) return rect.left - parent.left
		if (!hasCells(row)) {
			for (const child of row.rows()) {
				const box = this.#rectOf(child.id)
				if (box && box.left > rect.left) return box.left - rect.left
			}
		}
		return ASSUMED_INDENT
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