import {DEFAULT_OPTIONS} from '../../shared/constants'
import {signal, batch} from '../../shared/signals'
import type {SignalValues} from '../../shared/signals'
import type {
	CoreOption,
	OverlayTrigger,
	CSSProperties,
	CoreSlots,
	CoreSlotProps,
	DraggableConfig,
	Slot,
} from '../../shared/types'
import {shallow} from '../../shared/utils/shallow'
import type {Store} from '../../store/Store'

export class PropsFeature {
	readonly value = signal<string | undefined>(undefined, {readonly: true})
	readonly defaultValue = signal<string | undefined>(undefined, {readonly: true})

	readonly onChange = signal<((value: string) => void) | undefined>(undefined, {readonly: true})

	readonly options = signal<CoreOption[]>(DEFAULT_OPTIONS, {readonly: true})
	readonly readOnly = signal<boolean>(false, {readonly: true})

	readonly layout = signal<'inline' | 'block'>('inline', {readonly: true})
	readonly draggable = signal<boolean | DraggableConfig>(false, {readonly: true})

	readonly showOverlayOn = signal<OverlayTrigger>('change', {readonly: true})

	readonly Span = signal<Slot | undefined>(undefined, {readonly: true})
	readonly Mark = signal<Slot | undefined>(undefined, {readonly: true})
	readonly Overlay = signal<Slot | undefined>(undefined, {readonly: true})

	readonly className = signal<string | undefined>(undefined, {readonly: true})
	readonly style = signal<CSSProperties | undefined>(undefined, {equals: shallow, readonly: true})

	readonly slots = signal<CoreSlots | undefined>(undefined, {readonly: true})
	readonly slotProps = signal<CoreSlotProps | undefined>(undefined, {readonly: true})

	constructor(private readonly _store: Store) {}

	set(values: Partial<SignalValues<typeof this>>): void {
		batch(
			() => {
				// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
				for (const key of Object.keys(values) as (keyof typeof this)[]) {
					if (!(key in this))
						continue
						// oxlint-disable-next-line no-unsafe-type-assertion -- heterogeneous signal map: per-key types verified by SignalValues<T> at the call site
					;(this[key] as (v: unknown) => void)(values[key] as never)
				}
			},
			{mutable: true}
		)
	}
}