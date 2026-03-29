<script lang="ts">
import {resolveOptionSlot} from '@markput/core'
import type {Token as TokenType} from '@markput/core'
import {
	computed,
	defineComponent,
	h,
	markRaw,
	provide,
	toRef,
	type Component,
	type PropType,
	type Ref,
	type VNode,
} from 'vue'

import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import type {MarkProps, Option} from '../types'
import Span from './Span.vue'

const SpanRaw = markRaw(Span)

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
		const optionsRef = store.state.options.use() as Ref<Option[] | undefined>
		const GlobalMarkRef = store.state.Mark.use() as Ref<Component | undefined>
		const GlobalSpanRef = store.state.Span.use() as Ref<Component | undefined>

		const resolved = computed(() => {
			const token = props.mark
			if (token.type === 'text') {
				return [GlobalSpanRef.value ?? SpanRaw, {value: token.content}] as const
			}
			const option = optionsRef.value?.[token.descriptor.index]
			const baseProps: MarkProps = {value: token.value, meta: token.meta}
			const compProps = resolveOptionSlot(option?.mark, baseProps)
			const Comp = (option?.Mark || GlobalMarkRef.value) as Component
			if (!Comp) throw new Error('No mark component found. Provide either option.Mark or global Mark.')
			return [Comp, compProps] as const
		})

		return () => {
			const [Comp, compProps] = resolved.value

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
