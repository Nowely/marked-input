<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {defineComponent, h, markRaw, provide, toRef, type PropType, type VNode, type VNodeRef} from 'vue'

import {useMarkput} from '../lib/hooks/useMarkput'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'

function domRef(ref: (element: HTMLElement | null) => void): VNodeRef {
	return value => {
		ref(value instanceof HTMLElement ? value : null)
	}
}

const Token = defineComponent({
	name: 'Token',
	props: {
		token: {type: Object as PropType<TokenType>, required: true},
	},
	setup(props): () => VNode {
		provide(
			TOKEN_KEY,
			toRef(() => props.token)
		)

		const store = useStore()
		const resolveMarkSlot = useMarkput(s => s.mark.slot)
		const index = useMarkput(s => s.parsing.index)
		const readOnly = useMarkput(s => s.props.readOnly)

		return () => {
			const mark = props.token
			const path = index.value.pathFor(mark)
			if (!path) return h('span')

			if (mark.type === 'text') {
				const [Comp, compProps] = resolveMarkSlot.value(mark)
				const textSurface = h(
					'span',
					{
						ref: domRef(store.dom.refFor({role: 'text', path})),
						contenteditable: String(!readOnly.value),
					},
					mark.content
				)
				return h('span', {ref: domRef(store.dom.refFor({role: 'token', path}))}, [
					typeof Comp === 'string'
						? h(Comp, compProps, [textSurface])
						: h(Comp, compProps, () => textSurface),
				])
			}

			const [Comp, compProps] = resolveMarkSlot.value(mark)
			const children =
				mark.children.length > 0
					? () =>
							h(
								'span',
								{ref: domRef(store.dom.refFor({role: 'slotRoot', path}))},
								mark.children.map(child =>
									h(markRaw(Token), {
										key: index.value.key(index.value.pathFor(child) ?? []),
										token: child,
									})
								)
							)
					: undefined

			return h('span', {ref: domRef(store.dom.refFor({role: 'token', path}))}, [h(Comp, compProps, children)])
		}
	},
})

export default Token
</script>
