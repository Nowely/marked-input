import type {RowNode} from '@markput/core'
import {renderSubscription} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {Token} from './Token'

interface BlockProps {
	node: RowNode
}

/**
 * A row, painted by its KIND's component — a paragraph falls back to `slots.block`. The grip,
 * the drop indicators and the menu that used to be painted here live in the editor's one
 * `BlockControls`, so a row is no longer a mixture of document content and editor UI.
 *
 * The component and its props come from `slots.node`, the same resolver `Token` asks: a row is a
 * node, and the class/style merge that used to sit here by hand is the resolver's answer now.
 */
export const Block = memo(({node}: BlockProps) => {
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
	// old one. The wrapper IS the row's token element (issue 08) AND its child-sequence host, so
	// the row's children hang off it directly.
	const consignBlock = useMemo(() => tokens.consign(node.id), [tokens, node.id])
	const hostBlock = useMemo(() => tokens.children(node.id), [tokens, node.id])

	const setBlockRef = (el: HTMLElement | null) => {
		consignBlock(el)
		hostBlock(el)
	}

	const [Component, props] = resolveNodeSlot(node)

	return (
		<Component
			{...props}
			ref={setBlockRef}
			// oxlint-disable-next-line no-unsafe-type-assertion -- props.style is raw and needs casting to CSSProperties
			style={{opacity: isDragging ? 0.4 : 1, ...(props.style as CSSProperties | undefined)}}
		>
			{node.children().map(child => (
				<Token key={child.id} node={child} depth={0} />
			))}
		</Component>
	)
})

Block.displayName = 'Block'