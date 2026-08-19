import type {Host} from '../features/state/Host'
import type {TokenModel} from '../features/tokens'

/**
 * What a consumer holds through the `ref` prop: React's `useImperativeHandle` target
 * (`react/.../MarkedInput.tsx`) and Vue's `defineExpose` argument (`vue/.../MarkedInput.vue`).
 *
 * TWO MEMBERS, deliberately. The v2 surface added twelve more — `value`, `nodes`, `find`,
 * `changed`, `insertMark`, `replaceText`, `replaceRange`, `setValue`, `tx`, `selection`,
 * `select`, `caret` — and they are withdrawn: the editor is driven by its props, so a write
 * belongs in the `value` a parent already owns, not in a second imperative path that has to
 * agree with it. What is left is what props cannot express: the host element, and moving the
 * caret into it.
 *
 * It owns nothing. Both members lower onto a state owner — the host for the element, the token
 * layer for the caret — so the shape of the handle can move without moving state.
 */
export class MarkputHandle {
	constructor(
		private readonly host: Host,
		private readonly tokens: TokenModel
	) {}

	get container(): HTMLElement | null {
		return this.host.container()
	}

	focus(): void {
		this.tokens.focusFirst()
	}
}