import type {TreeNode} from '@markput/core'
import {renderSubscription} from '@markput/core'
import type {CSSProperties} from 'react'
import {memo, useMemo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'
import {TokenChildren} from './TokenChildren'

/**
 * `depth` arrives by construction: the parent that maps the tree knows it. The render-time
 * `TokenPath` that used to travel alongside it went at S1.8 step 4 — its last reader was
 * `TokenChildren`, which now registers under the owner's stable id.
 */
/**
 * THE per-node subscription (spec S2 D8) — what replaced the snapshot value comparator. The
 * field contract itself lives in core (`renderSubscription`); what it adds HERE is what
 * `memo`'s default reference compare cannot see. That compare already suppresses the fan-out
 * the comparator was measured against: adoption keeps a node OBJECT exactly when it keeps its
 * id, and an edit before a mark only moves its `position`, a plain field (S1 D3) no component
 * reads. What it cannot see is a mark whose value changed INSIDE that same object — this is
 * what sees it.
 */
/**
 * THE MARK WRAPPER. A Mark's element is rendered by the CONSUMER, so core cannot ask for it
 * without asking the consumer to forward a ref — and a consumer may legitimately pass a
 * third-party component (`Tag`, `Chip`) straight through as their Mark, which forwards nothing.
 * Wrapping in an element markput owns removes the question: the wrapper carries the consignment
 * ref, and the editable policy writes the atomicity attribute onto IT rather than onto the
 * consumer's element. Core stops writing to consumer DOM entirely.
 *
 * `display: contents` is load-bearing, not decoration — MEASURED against a bare span across five
 * shapes. It matches "no wrapper" exactly everywhere; a bare span shifts a block `h1` down 18px,
 * moves an `li` out of place, and turns a flex or grid child inline, collapsing a grid cell from
 * 640px to 8px. The wrapper must generate no box.
 *
 * A TEXT token gets no wrapper: its element is the Surface core writes into, so interposing one
 * would put the text in the wrong place. Its element is markput's own `span` by default, so the
 * ref lands natively there.
 */
const markWrapperStyle: CSSProperties = {display: 'contents'}

export const Token = memo(({node, depth}: {node: TreeNode; depth: number}) => {
	const {resolveNodeSlot, store} = useMarkput(s => ({
		resolveNodeSlot: s.slots.node,
		store: s,
	}))
	// The selector closes over THIS render's `node` and `useMarkput` never re-runs it. Safe
	// by construction: the component is keyed by `node.id`, ids are never reused within an
	// input instance, and a node keeps its object for exactly as long as it keeps its id —
	// so a different node is a different key and a fresh component.
	useMarkput(() => renderSubscription(node))

	const [Component, props] = resolveNodeSlot(node)

	// The token's element, handed to core instead of core re-deriving it by walking the painted
	// DOM. Stable per node id for `TokenChildren`'s reason: a fresh callback each render would
	// deregister and re-register on every paint.
	const setRef = useMemo(() => store.tokens.consign(node.id), [store, node.id])

	const childNodes = node.kind === 'mark' ? node.children() : []
	const children =
		childNodes.length > 0 ? (
			<TokenChildren ownerId={node.id}>
				{childNodes.map(child => (
					<Token key={child.id} node={child} depth={depth + 1} />
				))}
			</TokenChildren>
		) : undefined

	const painted =
		node.kind === 'mark' ? (
			children ? (
				<Component {...props}>{children}</Component>
			) : (
				<Component {...props} />
			)
		) : (
			<Component {...props} ref={setRef} />
		)

	return (
		<TokenContext value={{store, node, depth}}>
			{node.kind === 'mark' ? (
				<span ref={setRef} style={markWrapperStyle}>
					{painted}
				</span>
			) : (
				painted
			)}
		</TokenContext>
	)
})

Token.displayName = 'Token'