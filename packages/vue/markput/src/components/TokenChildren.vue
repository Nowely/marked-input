<script lang="ts">
import {defineComponent, h, onBeforeUnmount, watch} from 'vue'

import {useStore} from '../lib/hooks/useStore'

export default defineComponent({
	name: 'TokenChildren',
	props: {
		/** The owning mark's stable id — the key `tokens.children` registers under since S1.8. */
		ownerId: {type: Number, required: true},
	},
	setup(props, {slots}) {
		const store = useStore()
		let childSequenceRef: ((element: HTMLElement | null) => void) | undefined
		let currentElement: HTMLElement | null = null

		const getChildSequenceRef = () => {
			if (childSequenceRef) return childSequenceRef
			childSequenceRef = store.tokens.children(props.ownerId)
			return childSequenceRef
		}

		const setElement = (el: unknown) => {
			currentElement = el instanceof HTMLElement ? el : null
			getChildSequenceRef()?.(currentElement)
		}

		watch(
			() => props.ownerId,
			() => {
				childSequenceRef?.(null)
				childSequenceRef = store.tokens.children(props.ownerId)
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
