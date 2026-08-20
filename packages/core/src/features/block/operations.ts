import type {NodeAnchor, TreeNode} from '../tokens'

/** An anchor-addressed slice of the document — backed by `tokens.valueBetween` in production. */
export type SliceRead = (from: NodeAnchor, to: NodeAnchor) => string

export type DragApplyResult = {
	readonly value: string
	/** Index of the row the caret enters in the RESULT — a node the commit is about to produce, never a character offset. */
	readonly row: number
}

/**
 * The document as per-row texts and inter-row gaps, read through anchors — the
 * tree's own string, never the props-first `value()`. Recomposition is
 * `texts[0] + gaps[0] + texts[1] + …`; every operation below edits these arrays
 * and derives its caret from the parts it kept, so the caret always indexes the
 * string it returns.
 *
 * A live tree's roots TILE the document, so every gap is `''` there. The channel
 * is what keeps that from being an assumption: a non-tiling tree composes back to
 * itself instead of silently losing the text between two rows.
 */
function project(read: SliceRead, rows: readonly TreeNode[]): {texts: string[]; gaps: string[]} {
	const texts = rows.map(row => read({before: row}, {after: row}))
	const gaps = rows.slice(0, -1).map((row, i) => read({after: row}, {before: rows[i + 1]}))
	return {texts, gaps}
}

function compose(texts: readonly string[], gaps: readonly string[]): string {
	const parts: string[] = []
	texts.forEach((text, i) => {
		parts.push(text)
		if (i < gaps.length) parts.push(gaps[i])
	})
	return parts.join('')
}

/** Splice `content` in as row `at`, with an empty gap holding it apart from its new neighbour. */
function insertRow(
	texts: readonly string[],
	gaps: readonly string[],
	at: number,
	content: string
): {newTexts: string[]; newGaps: string[]} {
	return {
		newTexts: [...texts.slice(0, at), content, ...texts.slice(at)],
		newGaps: at >= texts.length ? [...gaps, ''] : [...gaps.slice(0, at), '', ...gaps.slice(at)],
	}
}

/**
 * The two adds no anchor can name, and the whole of what is left of the composed path.
 *
 * An EMPTY tree has no row to insert after; a NEGATIVE `afterIndex` means before the first
 * row, which `insertAfter` cannot express. Neither is reachable from the block menu, whose
 * `addBlock` passes its own row index — they are kept composed rather than approximated by a
 * verb, so no input changes answer.
 */
export function addRowUnanchored(
	read: SliceRead,
	rows: readonly TreeNode[],
	afterIndex: number,
	separator: string
): DragApplyResult {
	// Stated rather than composed: with no row to address, both answers are constants.
	// One separator IS two rows under issue 08's trailing convention — an empty
	// terminated row plus the empty document-final one — with the caret in the first.
	if (rows.length === 0) {
		return {value: separator, row: 0}
	}
	const {texts, gaps} = project(read, rows)
	const at = Math.max(Math.min(afterIndex + 1, texts.length), 0)
	const {newTexts, newGaps} = insertRow(texts, gaps, at, separator)
	return {value: compose(newTexts, newGaps), row: at}
}