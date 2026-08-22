/**
 * THE control chrome's DOM membership: which elements sit on the path from a registered control
 * up to the editing host.
 *
 * One reader, `DomModel`'s locate walk, which stops at a control root and answers
 * `{kind: 'control'}` rather than resolving to the token that contains it. That is what keeps the
 * caret and the browser's own editing out of grips, menus and overlays.
 *
 * IT OWNS THE SET, and that is the point of the module. This used to be recomputed inside every
 * `bind` from a registry the model held, so a control's ref cost a whole-tree walk — and block
 * layout registered up to four controls PER ROW (two drop indicators, a drag handle, a menu),
 * which made mounting a block document quadratic: measured at 400 rows, 400 registrations drove
 * 400 binds in 93 ms, growing 3.7x per doubling. Block chrome is ONE layer with one registration
 * now, but registration stays O(depth) here and touches no token.
 */
export type ControlRoots = {
	/** Register a control and mark its ancestor chain. Cheap enough to call from a ref. */
	add(element: HTMLElement): void
	/**
	 * Unregister a control. REBUILDS from the survivors rather than subtracting: an ancestor chain
	 * is a union, so the elements this control contributed cannot be told from the ones it shared
	 * with another. O(controls x depth), and there are never many controls in flight at once —
	 * unlike registrations, which arrive one per row.
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