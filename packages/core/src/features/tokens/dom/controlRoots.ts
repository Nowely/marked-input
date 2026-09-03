/**
 * THE control roots' DOM membership: which elements sit on the path from a registered control
 * up to the editing host.
 *
 * One reader, `DomModel`'s locate walk, which stops at a control root and answers
 * `{kind: 'control'}` rather than resolving to the token that contains it. That is what keeps the
 * caret and the browser's own editing out of grips, menus and overlays.
 *
 * IT OWNS THE SET, and that is the point of the module. This used to be recomputed inside every
 * `bind` from a registry the model held, so a control's ref cost a whole-tree walk — and the
 * editor registered up to four controls PER ROW (two drop indicators, a drag handle, a menu),
 * which made mounting a document with rows quadratic: measured at 400 rows, 400 registrations drove
 * 400 binds in 93 ms, growing 3.7x per doubling. The row controls are ONE layer with one registration
 * now, but registration stays O(depth) here and touches no token.
 */
export type ControlRoots = {
	/** Register a control and mark its ancestor chain. Cheap enough to call from a ref. */
	add(element: HTMLElement): void
	/**
	 * Unregister a control. REBUILDS from the survivors rather than subtracting: an ancestor chain
	 * is a union, so the elements this control contributed cannot be told from the ones it shared
	 * with another. O(controls x depth).
	 *
	 * "AND THERE ARE NEVER MANY CONTROLS IN FLIGHT AT ONCE" USED TO STAND HERE, and its own new
	 * caller falsified it: `useControlRef` is published, and a consumer's row kind registers ONE
	 * PER ROW — the Notion showcase files ~16 on a 36-row page (a bullet's dot, a
	 * to-do's box, a toggle's arrow, a callout's icon, a fence's language select, and the frozen
	 * interior of every atomic kind). On an N-row bullet document that is N registrations, and
	 * removing one row rebuilds all N chains.
	 *
	 * Left as it is, WITH A NUMBER STILL OWED: the shape is quadratic in a document's controls
	 * and no one has benchmarked it at scale. The row's own element is what a consumer registers,
	 * so the chains are short; that is a reason to expect it to be cheap, not a measurement.
	 * Whoever next touches this module owes the benchmark or the subtraction.
	 */
	remove(element: HTMLElement): void
	has(element: HTMLElement): boolean
	/**
	 * Recompute every chain. The container is the walk's stop condition, so a control registered
	 * before one attached marked nothing and a container SWAP invalidates every chain that was
	 * marked against the previous host.
	 */
	rebuild(): void
}

export function createControlRoots(container: () => HTMLElement | null): ControlRoots {
	const controls = new Set<HTMLElement>()
	let roots = new WeakSet<HTMLElement>()

	const mark = (control: HTMLElement): void => {
		const host = container()
		if (!host) return
		let element: HTMLElement | null = control
		// Up to but NOT including the host: the container itself is the editing host, and marking
		// it would make every element in the document answer `'control'`.
		while (element && element !== host) {
			roots.add(element)
			element = element.parentElement
		}
	}

	const rebuild = (): void => {
		roots = new WeakSet<HTMLElement>()
		for (const control of controls) mark(control)
	}

	return {
		add(element) {
			controls.add(element)
			mark(element)
		},
		remove(element) {
			controls.delete(element)
			rebuild()
		},
		has: element => roots.has(element),
		rebuild,
	}
}