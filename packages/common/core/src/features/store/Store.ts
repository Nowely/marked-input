import {NodeProxy} from '../../shared/classes/NodeProxy'
import {defineState, defineEvents, type UseHookFactory} from '../../shared/classes'
import type {Parser, Token} from '../parsing'
import type {
	CoreOption,
	CoreSlotProps,
	CoreSlots,
	GenericComponent,
	OverlayMatch,
	OverlayTrigger,
	Recovery,
	StyleProperties,
} from '../../shared/types'
import {SystemListenerController} from '../events'
import {KeyGenerator} from '../../shared/classes/KeyGenerator'
import {OverlayController} from '../overlay'
import {FocusController} from '../focus'
import {KeyDownController} from '../input'
import {TextSelectionController} from '../selection'

export interface StoreOptions {
	createUseHook: UseHookFactory
}

export class Store {
	readonly key = new KeyGenerator()

	readonly nodes = {
		focus: new NodeProxy(undefined, this),
		input: new NodeProxy(undefined, this),
	}

	readonly state: ReturnType<
		typeof defineState<{
			tokens: Token[]
			parser: Parser | undefined
			previousValue: string | undefined
			recovery: Recovery | undefined
			selecting: 'drag' | 'all' | undefined
			overlayMatch: OverlayMatch | undefined
			value: string | undefined
			defaultValue: string | undefined
			onChange: ((value: string) => void) | undefined
			readOnly: boolean
			options: CoreOption[] | undefined
			showOverlayOn: OverlayTrigger | undefined
			Mark: GenericComponent | undefined
			Overlay: GenericComponent | undefined
			className: string | undefined
			style: StyleProperties | undefined
			slots: CoreSlots | undefined
			slotProps: CoreSlotProps | undefined
		}>
	>

	readonly events = defineEvents<{
		change: void
		parse: void
		delete: {token: Token}
		select: {mark: Token; match: OverlayMatch}
		clearOverlay: void
		checkOverlay: void
	}>()

	readonly refs = {
		container: null as HTMLDivElement | null,
		overlay: null as HTMLElement | null,
	}

	readonly controllers = {
		overlay: new OverlayController(this),
		focus: new FocusController(this),
		keydown: new KeyDownController(this),
		system: new SystemListenerController(this),
		textSelection: new TextSelectionController(this),
	}

	constructor(options: StoreOptions) {
		this.state = defineState(
			{
				tokens: [] as Token[],
				parser: undefined as Parser | undefined,
				previousValue: undefined as string | undefined,
				recovery: undefined as Recovery | undefined,
				selecting: undefined as 'drag' | 'all' | undefined,
				overlayMatch: undefined as OverlayMatch | undefined,
				value: undefined as string | undefined,
				defaultValue: undefined as string | undefined,
				onChange: undefined as ((value: string) => void) | undefined,
				readOnly: false as boolean,
				options: undefined as CoreOption[] | undefined,
				showOverlayOn: undefined as OverlayTrigger | undefined,
				Mark: undefined as GenericComponent | undefined,
				Overlay: undefined as GenericComponent | undefined,
				className: undefined as string | undefined,
				style: undefined as StyleProperties | undefined,
				slots: undefined as CoreSlots | undefined,
				slotProps: undefined as CoreSlotProps | undefined,
			},
			options.createUseHook
		)
	}
}
