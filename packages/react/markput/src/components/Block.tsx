import type {RowNode} from '@markput/core'
import {renderSubscription} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
// oxlint-disable-next-line import/no-cycle -- A recursive component pair: `Rows` maps a sibling list and `Block` paints one row and its own list. The cycle is the recursion, and both sides are used only inside a render body.
import {Rows} from './Rows'
import {Token} from './Token'

interface BlockProps {
	node: RowNode
	/** Nesting depth and position among siblings — both known by the parent that mapped them. */
	depth: number
	index: number
}

/** `display: contents` for `TokenChildren`'s reason: the host must generate no box of its own. */
const rowsHostStyle: CSSProperties = {display: 'contents'}

/**
 * A row, painted by its KIND's component — a paragraph falls back to `slots.block`. The grip,
 * the drop indicators and the menu that used to be painted here live in the editor's one
 * `BlockControls`, so a row is no longer a mixture of document content and editor UI.
 *
 * The component and its props come from `slots.node`, the same resolver `Token` asks: a row is a
 * node, and the class/style merge that used to sit here by hand is the resolver's answer now.
 *
 * A row's CHILD ROWS reach a kind's component as the `rows` prop, so it decides where they go —
 * a toggle hides them, a bullet nests a list inside its `<li>`. A PARAGRAPH gets none: its
 * component is `slots.block`, whose default is a bare `div` that would stringify a React node
 * onto the element, so its child rows go in as ordinary children after the inline ones.
 */
export const Block = memo(({node, depth, index}: BlockProps) => {
	const {resolveNodeSlot, tokens} = useMarkput(s => ({
		resolveNodeSlot: s.slots.node,
		tokens: s.tokens,
	}))
	// A SCALAR subscription, deliberately not a field on the object selector above. The object
	// form rebuilds a fresh snapshot whenever any of its sources fires, so reading the editor's
	// one `dragging` signal there would re-render EVERY row the moment any row is picked up —
	// the exact regression an editor-level signal invites. As a boolean it notifies only
	// when THIS row's own answer flips. The closure is safe for `Token`'s reason: the component
	// is keyed by `node.id` and ids are never reused.
	const isDragging = useMarkput(s => () => s.block.state.dragging() === node.id)
	// The per-row subscription: a row's kind, its meta and its children are what this component
	// paints, so an edit to any of them must re-render it — `renderSubscription`'s row arm, the
	// same job its mark arm does for Token.
	useMarkput(() => renderSubscription(node))

	// MEMOISED, unlike `setBlockRef` below: `consign` and `children` mint a registration key per
	// CALL, so calling them inline would file a fresh entry on every paint and never release the
	// old one. The wrapper IS the row's token element (issue 08) AND its INLINE child-sequence
	// host, so the row's own content hangs off it directly.
	const consignBlock = useMemo(() => tokens.consign(node.id), [tokens, node.id])
	const hostBlock = useMemo(() => tokens.children(node.id), [tokens, node.id])
	const hostRows = useMemo(() => tokens.children(node.id, 'rows'), [tokens, node.id])

	const setBlockRef = (el: HTMLElement | null) => {
		consignBlock(el)
		hostBlock(el)
	}

	const childRows = node.rows()
	// HIDDEN rather than absent is the consumer's contract for a collapsed row: an unpainted row
	// leaves `bind` and takes its anchors with it. What is absent here is the HOST, and only when
	// the row genuinely has no children.
	const rows =
		childRows.length > 0 ? (
			<span ref={hostRows} style={rowsHostStyle}>
				<Rows rows={childRows} depth={depth + 1} />
			</span>
		) : undefined

	const [Component, props] = resolveNodeSlot(node, {depth, index})
	// `node` in the resolved props is core's answer for "this row paints through its KIND's own
	// component", and the kind is the one that takes `rows` as a PROP. A paragraph's is
	// `slots.block`, whose default is a bare `div` that would stringify a React node onto the
	// element, so its child rows go in as ordinary children instead.
	const isKind = 'node' in props

	return (
		<Component
			{...props}
			{...(isKind ? {rows} : {})}
			ref={setBlockRef}
			// oxlint-disable-next-line no-unsafe-type-assertion -- props.style is raw and needs casting to CSSProperties
			style={{opacity: isDragging ? 0.4 : 1, ...(props.style as CSSProperties | undefined)}}
		>
			{node.inline().map(child => (
				<Token key={child.id} node={child} depth={0} />
			))}
			{isKind ? undefined : rows}
		</Component>
	)
})

Block.displayName = 'Block'