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

// Two ways in, and the names carry the difference. `set` writes EVERY declared prop, which is
// what an adapter owes on each render: a prop the caller dropped arrives as `undefined` and
// reverts to its declared default. `update` is a PATCH — it writes the keys it is given and
// leaves the rest alone.

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
	/**
	 * The structural row separator (issue 08): editor-level, belongs to no markup,
	 * applied in BLOCK layout only — inline layout never splits rows. Inside
	 * `__value__`/`__meta__` gaps it is that markup's own text, never a boundary.
	 */
	readonly separator = signal<string>({default: '\n\n', readonly: true})
	readonly draggable = signal<boolean | DraggableConfig>({default: false, readonly: true})

	readonly showOverlayOn = signal<OverlayTrigger>({default: 'change', readonly: true})

	readonly Span = signal<Slot>({readonly: true})
	readonly Mark = signal<Slot>({readonly: true})
	readonly Overlay = signal<Slot>({readonly: true})

	readonly className = signal<string>({readonly: true})
	readonly style = signal<CSSProperties>({equals: shallow, readonly: true})

	readonly slots = signal<CoreSlots>({readonly: true})
	readonly slotProps = signal<CoreSlotProps>({readonly: true})

	/**
	 * The adapter's full sync, called on every render: every declared prop takes its incoming
	 * value, so one the caller stopped passing arrives as `undefined` and a default-bearing
	 * signal reverts to its declared default.
	 *
	 * Reading the key list off `values` instead would leave a dropped prop stuck at the last
	 * value it was given — React reproduced exactly that, where `readOnly={true}` in one branch
	 * of a tabbed story and no `readOnly` in the other kept the editor read-only for good.
	 */
	set(values: Partial<SignalValues<typeof this>>): void {
		// Single unavoidable cast: SignalValues<T> verifies per-key value types at the
		// call site, but TS can't correlate key and value inside a loop.
		// oxlint-disable-next-line no-unsafe-type-assertion
		const setters = this as unknown as Record<string, (v: unknown) => void>
		const incoming: Record<string, unknown> = values
		batch(
			() => {
				for (const key of Object.keys(this)) setters[key](incoming[key])
			},
			{mutable: true}
		)
	}

	/** A PATCH: writes the keys present in `values` and leaves every other prop untouched. */
	update(values: Partial<SignalValues<typeof this>>): void {
		// oxlint-disable-next-line no-unsafe-type-assertion -- same reason as `set`
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