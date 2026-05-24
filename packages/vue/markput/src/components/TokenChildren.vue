<script lang="ts">
import type {TokenPath} from '@markput/core'
import {defineComponent, h, onBeforeUnmount, type PropType, watch} from 'vue'

import {useStore} from '../lib/hooks/useStore'

export default defineComponent({
	name: 'TokenChildren',
	props: {
		ownerPath: {type: Array as PropType<TokenPath>, required: true},
	},
	setup(props, {slots}) {
		const store = useStore()
		let childSequenceRef: ((element: HTMLElement | null) => void) | undefined
		let currentElement: HTMLElement | null = null

		const getChildSequenceRef = () => {
			if (childSequenceRef) return childSequenceRef
			childSequenceRef = store.bridge.childrenFor(props.ownerPath)
			return childSequenceRef
		}

		const setElement = (el: unknown) => {
			currentElement = el instanceof HTMLElement ? el : null
			getChildSequenceRef()?.(currentElement)
		}

		watch(
			() => props.ownerPath.join('.'),
			() => {
				childSequenceRef?.(null)
				childSequenceRef = store.bridge.childrenFor(props.ownerPath)
				childSequenceRef(currentElement)
			}
		)

		onBeforeUnmount(() => {
			childSequenceRef?.(null)
		})

		return () => h('span', {ref: setElement, style: {display: 'contents'}}, slots.default?.())
	},
})
</script>
