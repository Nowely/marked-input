import type {TreeNode} from './types'

/**
 * THE per-node repaint subscription (spec S2 D8) both adapters pass to `useMarkput` — the
 * single owner of which node fields reach a framework component. A mark repaints on
 * `value`/`meta`/`children`; a row on `children`, the one thing a Block paints; a text node
 * subscribes to nothing, because its element is the Surface core writes into.
 *
 * Deliberately NOT the shorter "resolve the slot inside the computed": that reads `text()`
 * for a text node and would repaint its Span on every keystroke, which is the one thing the
 * text path exists to avoid.
 *
 * A fresh tuple per evaluation is the point — the computed re-evaluates only when one of the
 * read signals fired, so a new reference IS the notification. The value is a repaint token,
 * not data (hence `unknown`); a consumer that needs the fields reads them off the node.
 */
export const renderSubscription = (node: TreeNode) => (): unknown =>
	node.kind === 'mark'
		? [node.value(), node.meta(), node.children()]
		: node.kind === 'row'
			? node.children()
			: undefined