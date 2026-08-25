import type {Computed, Signal} from '../../../shared/signals'
import {computed, signal} from '../../../shared/signals'
import type {MarkupDescriptor} from '../parser/core/MarkupDescriptor'
import type {RowToken, Token} from '../parser/types'
import {annotate} from '../parser/utils/annotate'
import {offsetOfAnchor} from './anchors'
import type {Id, MarkNode, NodeAnchor, RowNode, TextNode, TreeCommands, TreeNode} from './types'

export interface TokenTree {
	// NOT ReturnType<typeof signal<...>> — instantiation picks the last overload
	// (Signal<T | undefined>) and poisons every consumer with `| undefined`.
	readonly roots: Signal<readonly TreeNode[]>
	/**
	 * The separator the CURRENT roots were parsed under, which is what joins them back — not the
	 * props policy, which describes the NEXT parse. The two disagree for exactly one moment, and
	 * it is a moment that matters: on a layout flip the boundary reads this projection to decide
	 * what to re-parse, and reading the new policy there would fuse every row before anything had
	 * a chance to re-derive them.
	 *
	 * Written by the boundary at each fold, beside adoption's own writes.
	 *
	 * THE RULE FOR CALLERS: anything that reads `roots()` reads THIS. Reaching for
	 * `TokenModel.rowConfig` there answers the next parse's policy about the current roots — see
	 * the pins in `TokenModel.value.spec.ts` for the three documents that produced.
	 */
	readonly separator: Signal<string | undefined>
	readonly value: Computed<string>
	/** Allocates fresh ids from the tree-local counter; adoption builds its new nodes through it. */
	readonly buildNode: (token: Token | RowToken) => TreeNode
}

export function createTokenTree(
	tokens: readonly (Token | RowToken)[],
	/**
	 * Spec §2.3's `mark.update`/`mark.remove`. Optional because the tree is built UNWIRED in
	 * the specs and in the §7.1 snapshot gate, where there is no transaction layer to write
	 * through; an unwired node's verbs answer `false`, which is the same fail-closed answer a
	 * dead node gives.
	 */
	commands?: () => TreeCommands | undefined
): TokenTree {
	let nextId = 1
	const alloc = (): Id => nextId++

	const buildNode = (token: Token | RowToken): TreeNode => {
		if (token.type === 'row') {
			const node: RowNode = {
				kind: 'row',
				id: alloc(),
				descriptor: signal<MarkupDescriptor | undefined>({initial: token.descriptor}),
				meta: signal({initial: token.meta}),
				children: signal<readonly TreeNode[]>({initial: token.children.map(buildNode)}),
				option: () => node.descriptor()?.index,
				position: {...token.position},
				// DERIVED from the children's outer edges rather than stored: a row's body is
				// exactly what its inline children cover, so a stored range would be a second
				// reading of one fact — and the one adoption would have to keep in step.
				slotRange: () => outerEdges(node.children()),
				slot: () => joinNodes(node.children()),
				range: () => ({...node.position}),
				remove: () => commands?.()?.remove(node) ?? false,
				duplicate: () => commands?.()?.duplicate(node) ?? false,
				insertAfter: text => commands?.()?.insertAfter(node, text) ?? false,
				mergeWith: next => commands?.()?.mergeWith(node, next) ?? false,
				moveTo: index => commands?.()?.moveTo(node, index) ?? false,
			}
			return node
		}
		if (token.type === 'text') {
			const node: TextNode = {
				kind: 'text',
				id: alloc(),
				text: signal({initial: token.content}),
				position: {...token.position},
				range: () => ({...node.position}),
				remove: () => commands?.()?.remove(node) ?? false,
				duplicate: () => commands?.()?.duplicate(node) ?? false,
				insertAfter: text => commands?.()?.insertAfter(node, text) ?? false,
				mergeWith: next => commands?.()?.mergeWith(node, next) ?? false,
				moveTo: index => commands?.()?.moveTo(node, index) ?? false,
			}
			return node
		}
		const node: MarkNode = {
			kind: 'mark',
			id: alloc(),
			descriptor: token.descriptor,
			// A plain field, not a getter: `descriptor` is readonly and `descriptor.markup` is
			// immutable, so the two cannot diverge, and the node stays a plain data object the
			// equality helpers walk without surprises.
			markup: token.descriptor.markup,
			value: signal({initial: token.value}),
			meta: signal({initial: token.meta}),
			// Explicit generic: inferred `Signal<TreeNode[]>` is not assignable to
			// `Signal<readonly TreeNode[]>` (the write signature is contravariant).
			children: signal<readonly TreeNode[]>({initial: token.children.map(buildNode)}),
			// Field-wise, not a spread of `token.slot`: the token carries a `content` mirror
			// the node deliberately does not keep (see `MarkNode.slotRange`).
			slotRange: token.slot ? {start: token.slot.start, end: token.slot.end} : undefined,
			position: {...token.position},
			// Same rule as joinNodes and materializeNode: a slot mark always parses with >=1
			// text child, so children are the sole slot source.
			slot: () => (node.descriptor.hasSlot ? joinNodes(node.children()) : undefined),
			range: () => ({...node.position}),
			update: patch => commands?.()?.update(node, patch) ?? false,
			remove: () => commands?.()?.remove(node) ?? false,
			duplicate: () => commands?.()?.duplicate(node) ?? false,
			insertAfter: text => commands?.()?.insertAfter(node, text) ?? false,
			mergeWith: next => commands?.()?.mergeWith(node, next) ?? false,
			moveTo: index => commands?.()?.moveTo(node, index) ?? false,
		}
		return node
	}

	// Explicit generic for the same reason as `children` above.
	const roots = signal<readonly TreeNode[]>({initial: tokens.map(buildNode)})

	// No initial: an inline tree has no rows to join, and the boundary writes this at the first
	// fold. See {@link TokenTree.separator}.
	const separator = signal<string>()
	const value = computed(() => joinNodes(roots(), separator()))

	return {roots, separator, value, buildNode}
}

/** The outer edges of a sibling list — a row's slot range, and the parse's own body span. */
function outerEdges(nodes: readonly TreeNode[]): {start: number; end: number} {
	const first = nodes.at(0)
	const last = nodes.at(-1)
	// A parsed body always has at least one text child (`TreeBuilder.build`), so the empty
	// answer is unreachable from a parse; it is what a hand-built node would get.
	if (!first || !last) return {start: 0, end: 0}
	return {start: first.position.start, end: last.position.end}
}

/** Depth-first id lookup over live nodes (spec §2.3's `input.find`). */
export function findNode(nodes: readonly TreeNode[], id: Id): TreeNode | undefined {
	for (const node of nodes) {
		if (node.id === id) return node
		if (node.kind !== 'text') {
			const found = findNode(node.children(), id)
			if (found) return found
		}
	}
	return undefined
}

/** Index of the ROOT whose subtree contains `id` — the block row index, off ids instead of a handle's frozen path. */
export function rootIndexOf(roots: readonly TreeNode[], id: Id): number | undefined {
	for (let index = 0; index < roots.length; index++) {
		if (containsNode(roots[index], id)) return index
	}
	return undefined
}

function containsNode(node: TreeNode, id: Id): boolean {
	if (node.id === id) return true
	return node.kind !== 'text' && node.children().some(child => containsNode(child, id))
}

/**
 * The projection of the span between two anchors — {@link joinNodes} restricted to a window,
 * and the clipboard's markup serialization (spec S2 §4.5). The pair is normalized.
 *
 * A partially covered TEXT node contributes its overlapping slice. A partially covered MARK
 * contributes its WHOLE markup — `value`/`meta` have no sub-spans to cut — with its slot
 * trimmed by the same rule, so copying half of a mark's slot yields a valid annotation.
 *
 * DIVERGENCE from the deleted `clipboard/serializeRange.ts`, deliberate: when the window
 * covers a mark's markup but none of its slot children, that version emitted the mark's FULL
 * slot text (`toString`'s `children.length > 0 ? … : token.slot?.content` fallback) while
 * this one emits an empty slot, matching {@link joinNodes}. Unreachable from a selection —
 * a position inside a mark's markup is not anchorable — and the old answer was an accident
 * of the fallback, not a rule anyone stated.
 */
export function sliceNodes(roots: readonly TreeNode[], from: NodeAnchor, to: NodeAnchor, separator?: string): string {
	const a = offsetOfAnchor(roots, from)
	const b = offsetOfAnchor(roots, to)
	return sliceWithin(roots, Math.min(a, b), Math.max(a, b), separator)
}

function sliceWithin(nodes: readonly TreeNode[], start: number, end: number, separator?: string): string {
	let result = ''
	const lastRow = lastRowIndex(nodes)

	for (const [index, node] of nodes.entries()) {
		// Half-open overlap: a node touching the window only at a boundary contributes nothing.
		if (node.position.end <= start || node.position.start >= end) continue

		if (node.kind === 'text') {
			const text = node.text()
			result += text.slice(
				Math.max(0, start - node.position.start),
				Math.min(text.length, end - node.position.start)
			)
			continue
		}

		if (node.kind === 'row') {
			const separatorText = index < lastRow ? (separator ?? '') : ''
			const contentEnd = node.position.end - separatorText.length
			// A row whose BODY the window reaches is re-annotated from its kind, exactly as a
			// partly covered mark is: copying half a heading yields '# half'. A window touching
			// only the separator gets the separator alone — re-annotating there would invent an
			// empty row of that kind.
			if (start < contentEnd) {
				result += rowBody(node, sliceWithin(node.children(), start, end, separator))
			}
			result += separatorText.slice(
				Math.max(0, start - contentEnd),
				Math.min(separatorText.length, end - contentEnd)
			)
			continue
		}

		const slot = node.descriptor.hasSlot ? sliceWithin(node.children(), start, end, separator) : undefined
		result += annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot})
	}

	return result
}

/**
 * The string projection: mirrors parser/__testing__/toString over live nodes.
 *
 * ROWS ARE JOINED BY THE SEPARATOR, which is what replaced the terminator each row used to
 * store. One separator between every adjacent pair and none after the last, so
 * "the final row carries none" is structural rather than stored and normalized.
 */
export function joinNodes(nodes: readonly TreeNode[], separator?: string): string {
	let result = ''
	const lastRow = lastRowIndex(nodes)

	for (const [index, node] of nodes.entries()) {
		if (node.kind === 'text') {
			result += node.text()
			continue
		}

		if (node.kind === 'row') {
			result += rowContent(node)
			if (index < lastRow) result += separator ?? ''
			continue
		}

		// A slot mark always parses with >=1 text child, so children are the sole slot source;
		// the node stores no slot text.
		const slot = node.descriptor.hasSlot ? joinNodes(node.children(), separator) : undefined

		result += annotate(node.descriptor.markup, {value: node.value(), meta: node.meta(), slot})
	}

	return result
}

/** A row's own bytes, separator excluded: its kind's markup wrapped around its body. */
export function rowContent(node: RowNode): string {
	return rowBody(node, joinNodes(node.children()))
}

/**
 * A row's kind applied to a body string. A paragraph IS its body; a typed row re-annotates,
 * putting the body in the placeholder its kind declared — `__slot__` for an inline-parsed body,
 * `__value__` for a raw one.
 */
function rowBody(node: RowNode, body: string): string {
	const descriptor = node.descriptor()
	if (!descriptor) return body
	return annotate(descriptor.markup, {
		value: body,
		slot: body,
		meta: node.meta(),
	})
}

/** The last ROW in a sibling list: the one the join gives no separator. */
function lastRowIndex(nodes: readonly TreeNode[]): number {
	for (let index = nodes.length - 1; index >= 0; index--) {
		if (nodes[index].kind === 'row') return index
	}
	return -1
}