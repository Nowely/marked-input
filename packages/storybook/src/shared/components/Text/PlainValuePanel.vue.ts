import {computed, defineComponent, ref} from 'vue'

import './Text.css'

/**
 * The vue twin of `PlainValuePanel` in Text.tsx. The markup is identical on purpose: both
 * frameworks render the same stories, so their HTML snapshots have to be comparable.
 *
 * A `template:` string rather than an SFC because `vue-tsc` with `strictTemplates` refuses
 * `data-value` on a native element, and dropping the attribute would change what the panel
 * offers.
 */
export default defineComponent({
	props: {
		value: {type: String, required: true},
		/** 'right' | 'bottom'. Declared as a plain String: a `PropType` assertion is an
		 * unsafe cast by this repo's lint rules, and the only caller already narrows it. */
		position: {type: String, required: true},
	},
	setup(props) {
		const copied = ref(false)

		const stats = computed(() => {
			if (!props.value) return '0 words · 0 chars · 0 lines'
			const words = props.value.trim().split(/\s+/).filter(Boolean).length
			return `${words} words · ${props.value.length} chars · ${props.value.split('\n').length} lines`
		})

		function copy() {
			void navigator.clipboard.writeText(props.value)
			copied.value = true
			setTimeout(() => (copied.value = false), 1500)
		}

		return {copied, stats, copy}
	},
	template: `
		<div :class="'pvp-container pvp-' + position">
			<button class="pvp-copy" @click="copy">{{ copied ? 'Copied!' : 'Copy' }}</button>
			<div class="pvp-scroll">
				<pre class="pvp-pre" :data-value="value"><template v-if="value">{{ value }}</template><em v-else class="pvp-empty">(empty)</em></pre>
			</div>
			<div class="pvp-footer">
				<span class="pvp-footer-label">Plain text</span>
				<span>{{ stats }}</span>
			</div>
		</div>
	`,
})