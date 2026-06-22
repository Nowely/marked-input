<script lang="ts">
import type {Token as TokenType, TokenPath} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import TokenChildren from './TokenChildren.vue'

/**
 * `path` arrives by construction: the parent that maps the tree knows every
 * child's index, so no per-token lookup is needed — and none would work here,
 * since during a structural render the freshly published tree is not bound to
 * the node layer yet.
 */
const Token = defineComponent({
	name: 'Token',
	props: {
		token: {type: Object as PropType<TokenType>, required: true},
		path: {type: Array as PropType<TokenPath>, required: true},
	},
	setup(props): () => VNode | null {
		provide(
			TOKEN_KEY,
			toRef(() => ({path: props.path, token: props.token}))
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
							h(markRaw(TokenChildren), {ownerPath: props.path}, () =>
								token.children.map((child, i) =>
									h(markRaw(Token), {key: keyOf(child), token: child, path: [...props.path, i]})
								)
							)
					: undefined

			return children ? h(Comp, compProps, children) : h(Comp, compProps)
		}
	},
})

export default Token
</script>
