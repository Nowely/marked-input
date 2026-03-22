<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {computed, defineComponent, h, markRaw, provide, toRef, type PropType} from 'vue'

import {useTokenSlot} from '../lib/hooks/useSlot'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'

const Token = defineComponent({
	name: 'Token',
	props: {
		mark: {type: Object as PropType<TokenType>, required: true},
	},
	setup(props) {
		provide(
			TOKEN_KEY,
			toRef(() => props.mark)
		)

		const store = useStore()
		const key = store.key

		const resolved = computed(() => useTokenSlot(props.mark))

		return () => {
			const [Comp, compProps] = resolved.value

			const children =
				props.mark.type === 'mark' && props.mark.children.length > 0
					? () => props.mark.children.map(child => h(markRaw(Token), {key: key.get(child), mark: child}))
					: undefined

			return h(Comp, compProps, children)
		}
	},
})

export default Token
</script>
