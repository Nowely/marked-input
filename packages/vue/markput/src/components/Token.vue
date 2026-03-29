<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {computed, defineComponent, h, markRaw, provide, toRef, type Component, type PropType, type VNode} from 'vue'

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
		const optionsRef = store.state.options.use()
		const MarkRef = store.state.Mark.use()
		const SpanRef = store.state.Span.use()

		const resolved = computed(() => {
			// Access .value to register reactive dependencies
			optionsRef.value
			MarkRef.value
			SpanRef.value
			return store.slot.mark.get(props.mark)
		})

		return () => {
			const [Comp, compProps] = resolved.value

			const mark = props.mark
			const children =
				mark.type === 'mark' && mark.children.length > 0
					? () => mark.children.map(child => h(markRaw(Token), {key: key.get(child), mark: child}))
					: undefined

			return h(Comp as Component, compProps, children)
		}
	},
})

export default Token
</script>
