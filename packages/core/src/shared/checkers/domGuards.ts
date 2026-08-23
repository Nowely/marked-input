/** Safely narrow an event's target to Node. */
export function nodeTarget(event: {target: EventTarget | null}): Node | null {
	const {target} = event
	return target instanceof Node ? target : null
}

/**
 * DOM the CONSUMER owns the caret in: an EXPLICIT editable island strictly between `origin`
 * and `boundary`. The two callers differ only in where they stop — `keyboard/beforeInput.ts`
 * at the container, `tokens/dom/domBoundary.ts` at a mark's own element — and one asks it to
 * fail the input guard OPEN while the other asks it to decline a boundary. Both mean the same
 * thing by "island", so they read it here.
 *
 * The `contentEditable` PROPERTY, never `isContentEditable` — that distinction IS the test.
 * Every model-owned element under the container either inherits `true` from the host (bare
 * text surfaces, slot mark roots, their slot hosts, and every element the consumer renders
 * between them) or declares `false` (value-only mark roots and mark controls). So an INHERITED
 * reading calls every ordinary edit an island: it failed the input guard OPEN (MEASURED —
 * `input.spec`'s 'fails an unhandled type closed even when it originates BELOW the container'
 * is red under it) and it failed `domBoundary` CLOSED, declining every boundary on a slot
 * mark's own presentation and dropping the keystroke typed there. The property answers
 * `'inherit'` for exactly the bare ones.
 *
 * The property over the raw attribute because Chromium normalizes the spellings: an island
 * written `contenteditable=""` or `contenteditable="TRUE"` answers `'true'` here (both
 * pinned), where a string compare on `getAttribute` would miss it and cancel the consumer's
 * input.
 */
export function inExplicitEditableIsland(origin: Node, boundary: HTMLElement): boolean {
	let current = origin instanceof Element ? origin : origin.parentElement
	while (current && current !== boundary) {
		if (current instanceof HTMLElement) {
			if (current.contentEditable === 'true' || current.contentEditable === 'plaintext-only') return true
		}
		current = current.parentElement
	}
	return false
}

/** Get the next node from a TreeWalker as Text, or null. */
export function nextText(walker: TreeWalker): Text | null {
	const node = walker.nextNode()
	// oxlint-disable-next-line no-unsafe-type-assertion -- nodeType === 3 guarantees Text; instanceof Text breaks in test envs
	return node?.nodeType === 3 ? (node as Text) : null
}