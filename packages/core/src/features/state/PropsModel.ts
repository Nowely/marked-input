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
// user did not provide. For default-bearing props (e.g. `options`, `readOnly`)
// an incoming `undefined` means "not provided" — we must keep the current
// (default) value instead of clobbering it. Use this `set` transform on every
// prop signal that has a non-undefined `initial`.
const keepOnUndefined = <T>(next: T | undefined, previous: T): T => next ?? previous

export class PropsModel {
	readonly value = signal<string>({readonly: true})
	readonly defaultValue = signal<string>({readonly: true})

	readonly onChange = signal<(value: string) => void>({readonly: true})

	readonly options = signal<CoreOption[]>({
		initial: DEFAULT_OPTIONS,
		readonly: true,
		set: keepOnUndefined,
	})
	readonly readOnly = signal<boolean>({initial: false, readonly: true, set: keepOnUndefined})

	readonly layout = signal({
		initial: 'inline' as 'inline' | 'block',
		readonly: true,
		set: keepOnUndefined,
		computed: self => ({
			isBlock: () => self() === 'block',
		}),
	})
	readonly draggable = signal<boolean | DraggableConfig>({
		initial: false,
		readonly: true,
		set: keepOnUndefined,
	})

	readonly showOverlayOn = signal<OverlayTrigger>({
		initial: 'change',
		readonly: true,
		set: keepOnUndefined,
	})

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