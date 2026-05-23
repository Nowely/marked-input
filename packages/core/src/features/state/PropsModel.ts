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

// Framework adapters spread *every* prop into `set({...})`, including ones the
// user did not provide. Default-bearing props use `default: T` so that an
// incoming `undefined` reverts the signal to its declared default instead of
// clobbering it.

export class PropsModel {
	readonly value = signal<string>({readonly: true})
	readonly defaultValue = signal<string>({readonly: true})

	readonly onChange = signal<(value: string) => void>({readonly: true})

	readonly options = signal<CoreOption[]>({default: DEFAULT_OPTIONS, readonly: true})
	readonly readOnly = signal<boolean>({default: false, readonly: true})

	readonly layout = signal({
		default: 'inline' as 'inline' | 'block',
		readonly: true,
		computed: self => ({
			isBlock: () => self() === 'block',
		}),
	})
	readonly draggable = signal<boolean | DraggableConfig>({default: false, readonly: true})

	readonly showOverlayOn = signal<OverlayTrigger>({default: 'change', readonly: true})

	readonly Span = signal<Slot>({readonly: true})
	readonly Mark = signal<Slot>({readonly: true})
	readonly Overlay = signal<Slot>({readonly: true})

	readonly className = signal<string>({readonly: true})
	readonly style = signal<CSSProperties>({equals: shallow, readonly: true})

	readonly slots = signal<CoreSlots>({readonly: true})
	readonly slotProps = signal<CoreSlotProps>({readonly: true})

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