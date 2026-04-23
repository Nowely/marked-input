<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'

const Token = defineComponent({
	name: 'Token',
	props: {
		mark: {type: Object as PropType<TokenType>, required: true},
	},
	setup(props): () => VNode {
		provide(
			TOKEN_KEY,
			toRef(() => props.mark)
		)

		const store = useStore()
		const key = store.key
		const resolveMarkSlot = useMarkput(s => s.feature.mark.mark)

		return () => {
			const [Comp, compProps] = resolveMarkSlot.value(props.mark)

			const mark = props.mark
			const children =
				mark.type === 'mark' && mark.children.length > 0
					? () => mark.children.map(child => h(markRaw(Token), {key: key.get(child), mark: child}))
					: undefined

			return h(Comp, compProps, children)
		}
	},
})

export default Token
</script>
