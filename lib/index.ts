export {MarkedInput} from './components/MarkedInput'
export {annotate, denote} from './utils'
export {createMarkedInput} from './utils/createMarkedInput'
export {useMark} from './utils/useMark'
export {useOverlay} from './utils/useOverlay'

export type {MarkedInputProps, MarkedInputComponent} from './components/MarkedInput'
export type {DynamicMark} from './utils/useMark' //TODO rename to MarkProps or similar?
export type {OverlayProps} from './utils/useOverlay' //TODO rename?
export type {
    MarkedInputHandler,
    Markup,

    Trigger, //TODO named
    AnnotatedMark, //TODO named

    OptionProps, //TODO named
    PartialPick, //TODO Remove?
    OptionType, //TODO named

    MarkStruct,
    ConfiguredMarkedInput,
    ConfiguredMarkedInputProps,

    DivEvents, //TODO Removed?
    EventsFrom, //TODO Removed?

    label,
    value,
} from './types'

export {PLACEHOLDER} from './constants'