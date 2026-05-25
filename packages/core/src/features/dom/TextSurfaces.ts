import {watch} from '../../shared/signals/index.js'
import type {TokenModel} from '../parsing/TokenModel'
import type {Host} from '../state/Host'
import type {PropsModel} from '../state/PropsModel'
import type {DomIndex} from './DomIndex'
import {reconcileTextSurfaces} from './reconcileTextSurfaces'

export class TextSurfaces {
	#selecting = false

	constructor(
		host: Host,
		private readonly props: PropsModel,
		private readonly dom: DomIndex,
		private readonly tokens: TokenModel
	) {
		host.onMounted(() => {
			watch(this.dom.indexed, () => this.#reconcile())
			watch(this.props.readOnly, () => this.#reconcile())
		})
	}

	setSelecting(active: boolean): void {
		if (this.#selecting === active) return
		this.#selecting = active
		this.#reconcile()
	}

	#reconcile(): void {
		const readOnly = this.props.readOnly()
		const editable = !(readOnly || this.#selecting)
		reconcileTextSurfaces(this.dom.nodes(), this.tokens.index(), {editable, readOnly})
	}
}