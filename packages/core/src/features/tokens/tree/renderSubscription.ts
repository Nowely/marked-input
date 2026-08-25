import type {TreeNode} from './types'

/**
 * THE per-node repaint subscription (spec S2 D8) both adapters pass to `useMarkput` — the
 * single owner of which node fields reach a framework component. A mark repaints on
 * `value`/`meta`/`children`; a ROW on its kind, its meta and its children, because a row is
 * painted by its kind's component with its meta as props; a text node subscribes to nothing,
 * because its element is the Surface core writes into.
 *
 * The row's kind and meta are not decoration: reading `children` alone leaves every row control
 * dead after a turn-into — a todo whose checkbox flips `meta` keeps its old markup on screen
 * while the value already carries the new one, because the children the retype produced are
 * element-wise equal.
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
			? [node.descriptor(), node.meta(), node.children()]
			: undefined