<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import TokenChildren from './TokenChildren.vue'

/**
 * `depth` arrives by construction: the parent that maps the tree knows it. The render-time
 * `TokenPath` that used to travel alongside it went at S1.8 step 4 — its last reader was
 * `TokenChildren`, which now registers under the owner's stable id.
 */
const Token = defineComponent({
	name: 'Token',
	props: {
		token: {type: Object as PropType<TokenType>, required: true},
		depth: {type: Number, required: true},
	},
	setup(props): () => VNode | null {
		provide(
			TOKEN_KEY,
			toRef(() => ({depth: props.depth, token: props.token}))
		)

		const store = useStore()
		const keyOf = store.tokens.keyOf
		const resolveMarkSlot = useMarkput(s => s.slots.mark)

		return () => {
			const token = props.token
			const [Comp, compProps] = resolveMarkSlot.value(token)
			const children =
				token.type === 'mark' && token.children.length > 0
					? () =>
							h(markRaw(TokenChildren), {ownerId: keyOf(token)}, () =>
								token.children.map(child =>
									h(markRaw(Token), {
										key: keyOf(child),
										token: child,
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
