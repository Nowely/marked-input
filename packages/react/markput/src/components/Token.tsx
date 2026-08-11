import type {TreeNode} from '@markput/core'
import {memo} from 'react'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TokenContext} from '../lib/providers/TokenContext'
import {TokenChildren} from './TokenChildren'

/**
 * `depth` arrives by construction: the parent that maps the tree knows it. The render-time
 * `TokenPath` that used to travel alongside it went at S1.8 step 4 — its last reader was
 * `TokenChildren`, which now registers under the owner's stable id.
 */
/**
 * THE per-node subscription (spec S2 D8) — what replaced the snapshot value comparator.
 *
 * `memo`'s default reference compare already suppresses the fan-out that comparator was
 * measured against: adoption keeps a node OBJECT exactly when it keeps its id, and an edit
 * before a mark only moves its `position`, a plain field (S1 D3) no component reads. What
 * reference compare cannot see is a mark whose value changed INSIDE that same object —
 * this is what sees it.
 *
 * Deliberately not the shorter "call `resolveMarkSlot` inside the computed": that reads
 * `text()` for a text node and would repaint its Span on every keystroke, which is the one
 * thing the text path exists to avoid. These three are exactly the fields that reach a
 * framework component.
 *
 * A fresh tuple per evaluation, and that is the point — the computed re-evaluates only
 * when one of the three signals fired, so a new reference IS the notification.
 */
const nodeRender = (node: TreeNode) => () =>
	node.kind === 'mark' ? [node.value(), node.meta(), node.children()] : undefined

export const Token = memo(({node, depth}: {node: TreeNode; depth: number}) => {
	const {resolveMarkSlot, store} = useMarkput(s => ({
		resolveMarkSlot: s.slots.mark,
		store: s,
	}))
	// The selector closes over THIS render's `node` and `useMarkput` never re-runs it. Safe
	// by construction: the component is keyed by `node.id`, ids are never reused within an
	// input instance, and a node keeps its object for exactly as long as it keeps its id —
	// so a different node is a different key and a fresh component.
	useMarkput(() => nodeRender(node))

	const [Component, props] = resolveMarkSlot(node)
	const childNodes = node.kind === 'mark' ? node.children() : []
	const children =
		childNodes.length > 0 ? (
			<TokenChildren ownerId={node.id}>
				{childNodes.map(child => (
					<Token key={child.id} node={child} depth={depth + 1} />
				))}
			</TokenChildren>
		) : undefined

	return (
		<TokenContext value={{store, node, depth}}>
			{children ? <Component {...props}>{children}</Component> : <Component {...props} />}
		</TokenContext>
	)
})

Token.displayName = 'Token'