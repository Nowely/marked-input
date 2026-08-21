<script lang="ts">
import {defineComponent, h, onBeforeUnmount} from 'vue'

import {useStore} from '../lib/hooks/useStore'

export default defineComponent({
	name: 'TokenChildren',
	props: {
		/** The owning mark's stable id — the key `tokens.children` registers under since S1.8. */
		ownerId: {type: Number, required: true},
	},
	setup(props, {slots}) {
		const store = useStore()
		const childSequenceRef = store.tokens.children(props.ownerId)

		const setElement = (el: unknown) => {
			childSequenceRef(el instanceof HTMLElement ? el : null)
		}

		onBeforeUnmount(() => {
			childSequenceRef(null)
		})

		return () => h('span', {ref: setElement, style: {display: 'contents'}}, slots.default?.())
	},
})
</script>
