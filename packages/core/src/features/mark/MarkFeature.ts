import {computed} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Feature} from '../../shared/types'
import type {Store} from '../../store/Store'
import type {Token} from '../parsing'
import {resolveMarkSlot} from '../slots'
import type {MarkSlot} from '../slots'

export class MarkFeature implements Feature {
	readonly enabled: Computed<boolean> = computed(() => {
		const Mark = this._store.props.Mark()
		if (Mark) return true
		return this._store.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
	})

	readonly slot: MarkSlot = computed(() => {
		const options = this._store.props.options()
		const Mark = this._store.props.Mark()
		const Span = this._store.props.Span()
		return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
	})

	constructor(private readonly _store: Store) {}

	enable() {}

	disable() {}
}