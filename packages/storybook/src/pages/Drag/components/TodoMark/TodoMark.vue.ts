import {useMark, useMarkput} from '@markput/vue'
import {defineComponent, ref} from 'vue'

import styles from './TodoMark.module.css'

/**
 * The Vue twin of `TodoMark.react.tsx`. Both files export the same two names, and
 * `constants.ts` imports them through `./TodoMark`, which each project resolves to its own
 * side (`resolve.extensions` in vitest/Storybook, `moduleSuffixes` in tsc/vue-tsc).
 *
 * Written with `template:` rather than `h()` so it reads next to its React counterpart, and
 * with `inheritAttrs: false` because the mark reads through `useMark()` and declares no
 * props: the adapter always passes `value`/`meta`, and Vue would otherwise write both onto
 * the root element as attributes, which React never does.
 */

// ─── Shared state composable ──────────────────────────────────────────────────

const useTodo = () => {
	const mark = useMark()
	// `readOnly` LEFT the mark surface at S1.7 (§2.3 does not put editor state on a node).
	const readOnly = useMarkput(s => s.props.readOnly)
	const isDone = ref(mark.value() === 'x')
	const toggle = () => {
		isDone.value = !isDone.value
		mark.update({value: isDone.value ? 'x' : ' '})
	}
	return {isDone, toggle, readOnly, styles}
}

// ─── Mark components (one per option) ─────────────────────────────────────────

export const TodoItemMark = defineComponent({
	inheritAttrs: false,
	setup: () => useTodo(),
	template:
		'<div :class="[styles.todo, isDone && styles.done]">' +
		'<input type="checkbox" :class="styles.checkbox" :checked="isDone" :disabled="readOnly" @change="toggle" />' +
		'<slot />' +
		'</div>',
})

export const TodoIndent1Mark = defineComponent({
	inheritAttrs: false,
	setup: () => useTodo(),
	template:
		'<span :class="[styles.todoIndent1, isDone && styles.done]">' +
		'<input type="checkbox" :class="styles.checkbox" :checked="isDone" :disabled="readOnly" @change="toggle" />' +
		'<slot />' +
		'</span>',
})