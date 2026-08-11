<script lang="ts">
import type {TreeNode} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import TokenChildren from './TokenChildren.vue'

/**
 * `depth` arrives by construction: the parent that maps the tree knows it. The render-time
 * `TokenPath` that used to travel alongside it went at S1.8 step 4 — its last reader was
 * `TokenChildren`, which now registers under the owner's stable id.
 */
/**
 * THE per-node subscription (spec S2 D8) — the same rationale as `Token.tsx`, where it is
 * written out in full. Short version: adoption keeps a node OBJECT for as long as it keeps
 * its id, so Vue's own prop diffing already shields a mark whose only change is a
 * `position` move; what it cannot see is a value/meta/children change INSIDE that object.
 *
 * NOT `resolveMarkSlot` inside the tracked scope, which would be shorter: that reads
 * `text()` for a text node and would repaint its Span on every keystroke.
 */
const nodeRender = (node: TreeNode) => () =>
	node.kind === 'mark' ? [node.value(), node.meta(), node.children()] : undefined

const Token = defineComponent({
	name: 'Token',
	props: {
		node: {type: Object as PropType<TreeNode>, required: true},
		depth: {type: Number, required: true},
	},
	setup(props): () => VNode | null {
		provide(
			TOKEN_KEY,
			toRef(() => ({depth: props.depth, node: props.node}))
		)

		const resolveMarkSlot = useMarkput(s => s.slots.mark)
		// Captured ONCE, as every `useMarkput` target is: safe because the component is keyed
		// by `node.id` and a node keeps its object for exactly as long as it keeps its id.
		const rendered = useMarkput(() => nodeRender(props.node))

		return () => {
			// READ so Vue's render effect depends on it — this is what repaints a mark whose
			// value changed while its node object, and therefore its props, stayed put.
			void rendered.value
			const node = props.node
			const [Comp, compProps] = resolveMarkSlot.value(node)
			const childNodes = node.kind === 'mark' ? node.children() : []
			const children =
				childNodes.length > 0
					? () =>
							h(markRaw(TokenChildren), {ownerId: node.id}, () =>
								childNodes.map(child =>
									h(markRaw(Token), {
										key: child.id,
										node: child,
										depth: props.depth + 1,
									})
								)
							)
					: undefined

			return children ? h(Comp, compProps, children) : h(Comp, compProps)
		}
	},
})

export default Token
</script>
