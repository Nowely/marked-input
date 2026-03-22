<script lang="ts">
import type {MarkToken, Token as TokenType} from '@markput/core'
import {computed, defineComponent, h, inject, onMounted, provide, ref, toRef, watch, type PropType, type Ref} from 'vue'

import {useSlot} from '../lib/hooks/useSlot'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import type {MarkProps, Option} from '../types'

const TextTokenRenderer = defineComponent({
	name: 'TextTokenRenderer',
	setup() {
		const tokenRef = inject(TOKEN_KEY)!
		const token = tokenRef.value
		const elRef = ref<HTMLSpanElement | null>(null)

		const resolved = computed(() => useSlot('span'))
		const spanTag = computed(() => resolved.value[0])
		const spanProps = computed(() => resolved.value[1])

		if (token.type !== 'text') {
			throw new Error('TextTokenRenderer expects a TextToken')
		}

		onMounted(() => {
			if (elRef.value && elRef.value.textContent !== token.content) {
				elRef.value.textContent = token.content
			}
		})

		watch(
			() => token.content,
			content => {
				if (elRef.value && elRef.value.textContent !== content) {
					elRef.value.textContent = content
				}
			}
		)

		return () => h(spanTag.value as any, {...spanProps.value, ref: (el: any) => (elRef.value = el)})
	},
})

const MarkTokenRenderer = defineComponent({
	name: 'MarkTokenRenderer',
	setup() {
		const store = useStore()
		const tokenRef = inject(TOKEN_KEY)!
		const node = tokenRef.value as MarkToken
		const optionsRef = store.state.options.use() as Ref<Option[] | undefined>
		const key = store.key

		const markPropsData: MarkProps = {
			value: node.value,
			meta: node.meta,
		}

		const resolved = computed(() => {
			const option = optionsRef.value?.[node.descriptor.index]
			return useSlot('mark', option, markPropsData)
		})

		return () => {
			const [Comp, props] = resolved.value
			if (node.children.length > 0) {
				return h(
					Comp,
					props,
					node.children.map(child => h(Token, {key: key.get(child), mark: child}))
				)
			}
			return h(Comp, props)
		}
	},
})

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

		return () => {
			if (props.mark.type === 'mark') return h(MarkTokenRenderer)
			return h(TextTokenRenderer)
		}
	},
})

export default Token
</script>
