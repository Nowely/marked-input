<script lang="ts">
import type {Token as TokenType} from '@markput/core'
import {defineComponent, h, provide, toRef, type PropType} from 'vue'

import {TOKEN_KEY} from '../lib/providers/tokenKey'
// eslint-disable-next-line import/no-cycle
import MarkRenderer from './MarkRenderer.vue'
import TextSpan from './TextSpan.vue'

export default defineComponent({
	props: {
		mark: {type: Object as PropType<TokenType>, required: true},
		isNested: {type: Boolean, default: false},
	},
	setup(props) {
		provide(
			TOKEN_KEY,
			toRef(() => props.mark)
		)

		return () => {
			if (props.mark.type === 'mark') return h(MarkRenderer)
			if (props.isNested) return props.mark.content
			return h(TextSpan)
		}
	},
})
</script>
