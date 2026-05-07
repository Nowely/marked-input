import {computed} from '../../shared/signals/index.js'
import type {Computed} from '../../shared/signals/index.js'
import type {Token} from '../parsing'
import type {PropsModel} from '../props/PropsModel'
import {resolveMarkSlot} from '../slots'
import type {MarkSlot} from '../slots'

export class MarkFeature {
	readonly enabled: Computed<boolean> = computed(() => {
		const Mark = this.props.Mark()
		if (Mark) return true
		return this.props.options().some(opt => 'Mark' in opt && opt.Mark != null)
	})

	readonly slot: MarkSlot = computed(() => {
		const options = this.props.options()
		const Mark = this.props.Mark()
		const Span = this.props.Span()
		return (token: Token) => resolveMarkSlot(token, options, Mark, Span)
	})

	constructor(private readonly props: PropsModel) {}
}