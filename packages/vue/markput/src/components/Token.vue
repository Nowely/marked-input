<script lang="ts">
import type {TreeNode} from '@markput/core'
import {renderSubscription} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import {unwrapEl} from '../lib/unwrapEl'
import TokenChildren from './TokenChildren.vue'

/**
 * `depth` arrives by construction: the parent that maps the tree knows it. The render-time
 * `TokenPath` that used to travel alongside it went at S1.8 step 4 — its last reader was
 * `TokenChildren`, which now registers under the owner's stable id.
 */
/**
 * THE per-node subscription (spec S2 D8) — the field contract lives in core
 * (`renderSubscription`); what it adds HERE is what Vue's own prop diffing cannot see.
 * Adoption keeps a node OBJECT for as long as it keeps its id, so prop diffing already
 * shields a mark whose only change is a `position` move; what it cannot see is a
 * value/meta/children change INSIDE that object.
 */
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
		const rendered = useMarkput(() => renderSubscription(props.node))

		// The token's element, handed to core instead of core re-deriving it by walking the painted
		// DOM. Created once for the same reason `rendered` is captured once.
		const store = useStore()
		const consign = store.tokens.consign(props.node.id)
		const setTokenRef = (el: unknown) => {
			consign(unwrapEl(el))
		}

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

			// A MARK is wrapped in an element markput owns, which carries the consignment ref and
			// (via the editable policy) the atomicity attribute — so nothing is ever written onto
			// the consumer's own element and no ref is required from it. The wrapper generates no
			// box: measured, an inline mark's geometry is identical with and without it, and a
			// `li` inside a `ul` keeps `display: list-item` through it.
			//
			// A TEXT token needs none of that: its element is markput's own `span` by default, so
			// the ref lands natively.
			if (node.kind !== 'mark') {
				return h(Comp, {...compProps, ref: setTokenRef})
			}
			const painted = children ? h(Comp, compProps, children) : h(Comp, compProps)
			return h('span', {ref: setTokenRef, style: {display: 'contents'}}, [painted])
		}
	},
})

export default Token
</script>
