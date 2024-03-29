export {MarkedInput} from './components/MarkedInput'
export {denote} from './utils'
export {createMarkedInput} from './utils/createMarkedInput'
export {useMark} from './utils/useMark'
export {useOverlay} from './utils/useOverlay'
export {useListener} from './utils/useListener'

export type {MarkedInputProps, MarkedInputComponent} from './components/MarkedInput'
export type {MarkHandler} from './utils/useMark'
export type {OverlayHandler} from './utils/useOverlay'
export type {
	MarkedInputHandler,
	Markup,

	OverlayMatch,
	MarkMatch,
	OverlayTrigger,

	Option,

	MarkStruct,
	ConfiguredMarkedInput,

	label,
	value,
	Listener
} from './types'

export {SystemEvent} from './constants'
export {annotate} from "./utils/annotate";
export {PLACEHOLDER} from './PLACEHOLDER'
