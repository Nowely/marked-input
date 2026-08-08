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
	readonly readOnly = signal({default: false, readonly: true})

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
		// Single unavoidable cast: SignalValues<T> verifies per-key value types at the
		// call site, but TS can't correlate key and value inside a loop.
		// oxlint-disable-next-line no-unsafe-type-assertion
		const setters = this as unknown as Record<string, (v: unknown) => void>
		batch(
			() => {
				for (const [key, value] of Object.entries(values)) {
					if (key in this) setters[key](value)
				}
			},
			{mutable: true}
		)
	}
}