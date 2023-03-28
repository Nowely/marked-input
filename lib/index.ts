export {MarkedInput} from './components/MarkedInput'
export {annotate, denote} from './utils'
export {createMarkedInput} from './utils/createMarkedInput'
export {useMark} from './utils/useMark'
export {useOverlay} from './utils/useOverlay'
export {useListener} from './utils/useListener'

export type {MarkedInputProps, MarkedInputComponent} from './components/MarkedInput'
export type {DynamicMark} from './utils/useMark' //TODO rename to MarkProps or similar?
export type {OverlayProps} from './utils/useOverlay' //TODO rename?
export type {
	MarkedInputHandler,
	Markup,

	Trigger, //TODO named
	AnnotatedMark, //TODO named

	Option,

	MarkStruct,
	ConfiguredMarkedInput,

	label,
	value,
	Listener
} from './types'

export {PLACEHOLDER, SystemEvent} from './constants'
