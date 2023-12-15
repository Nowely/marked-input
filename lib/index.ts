export {MarkedInput} from './components/MarkedInput'
export {createMarkedInput} from './utils/functions/createMarkedInput'
export {useMark} from './utils/hooks/useMark'
export {useOverlay} from './utils/hooks/useOverlay'
export {useListener} from './utils/hooks/useListener'

export type {MarkedInputProps, MarkedInputComponent} from './components/MarkedInput'
export type {MarkHandler} from './utils/hooks/useMark'
export type {OverlayHandler} from './utils/hooks/useOverlay'
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
export {annotate} from "./utils/functions/annotate";
export {PLACEHOLDER} from "./constants";
export {denote} from './utils/functions/denote'
