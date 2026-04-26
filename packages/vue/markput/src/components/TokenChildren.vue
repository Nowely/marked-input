<script lang="ts">
import type {TokenPath} from '@markput/core'
import {defineComponent, h, onBeforeUnmount, type PropType} from 'vue'

import {useStore} from '../lib/hooks/useStore'

export default defineComponent({
	name: 'TokenChildren',
	props: {
		ownerPath: {type: Array as PropType<TokenPath>, required: true},
	},
	setup(props, {slots}) {
		const store = useStore()
		let childSequenceRef: ((element: HTMLElement | null) => void) | undefined

		const getChildSequenceRef = () => {
			if (childSequenceRef) return childSequenceRef
			childSequenceRef = store.dom.childrenFor(props.ownerPath)
			return childSequenceRef
		}

		const setElement = (el: unknown) => {
			getChildSequenceRef()?.(el instanceof HTMLElement ? el : null)
		}

		onBeforeUnmount(() => {
			childSequenceRef?.(null)
		})

		return () => h('span', {ref: setElement, style: {display: 'contents'}}, slots.default?.())
	},
})
</script>
