<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'

const Token = defineComponent({
	name: 'Token',
	props: {
		token: {type: Object as PropType<TokenType>, required: true},
	},
	setup(props): () => VNode | null {
		provide(
			TOKEN_KEY,
			toRef(() => props.token)
		)

		const store = useStore()
		const key = store.key
		const resolveMarkSlot = useMarkput(s => s.mark.slot)
		const index = useMarkput(s => s.parsing.index)

		return () => {
			const token = props.token
			const path = index.value.pathFor(token)
			if (!path || !index.value.addressFor(path)) return null

			const [Comp, compProps] = resolveMarkSlot.value(token)
			const children =
				token.type === 'mark' && token.children.length > 0
					? () => token.children.map(child => h(markRaw(Token), {key: key.get(child), token: child}))
					: undefined

			return h(Comp, compProps, children)
		}
	},
})

export default Token
</script>
