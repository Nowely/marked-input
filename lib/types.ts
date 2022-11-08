import {PLACEHOLDER} from "./constants";
import {FunctionComponent, ReactElement, RefObject} from "react";
import {OptionProps} from "./components/Option";
import {MarkedInputProps} from "./components/MarkedInput";
import {EventBus} from "./utils/EventBus";
import {useMark} from "./utils/useMark";

export type NodeData = {
    key: number
    mark: Mark
    ref?: RefObject<HTMLElement>
}

export interface Mark {
    label: string
    value?: string
}

//TODO rename ParsedMarkup, Match?
export interface AnnotatedMark extends Mark{
    annotation: string;
    label: string;
    value: string
    index: number;
    input: string;
    childIndex: number;
}

//TODO
export interface MarkProps extends Mark{
    //useMark: () => ReturnType<typeof useMark>
}

export interface OverlayProps {
    /**
     * Style with caret absolute position. Used for placing an overlay.
     */
    style: {
        left: number
        top: number
    }
    /**
     * Used for close overlay.
     */
    onClose: () => void
    /**
     * Used for insert an annotation instead a triggered value.
     */
    onSelect: (value: Mark) => void
    /**
     * Trigger details
     */
    trigger: Trigger
}

type label = `${string}${PLACEHOLDER.LABEL}${string}`
type value = `${string}${PLACEHOLDER.VALUE}${string}`

export type Markup = `${label}${value}` | `${label}`

//TODO T to unknown?
export type ElementOptions<T> = ReactElement<OptionProps<T>> | ReactElement<OptionProps<T>>[]

/** Piece of marked text: fragment of text or mark definition */
export type Piece = string | AnnotatedMark

export type KeyedPieces = Map<number, Piece>

type PartialPick<T, F extends keyof T> = Omit<Required<T>, F> & Partial<Pick<T, F>>

export type OptionType = PartialPick<OptionProps, "initMark" | "initOverlay"> & { index: number }

export type Options = OptionType[]

export type ConfiguredMarkedInputProps<T, T1 = OverlayProps> = Omit<MarkedInputProps<T, T1>, "Mark" | "Overlay" | "children">
export type ConfiguredMarkedInput<T, T1 = OverlayProps> = FunctionComponent<ConfiguredMarkedInputProps<T, T1>>

export type Store = {
    options: Options
    //pieces: KeyedPieces
    bus: EventBus
    props: ExtractedProps
}

export type ExtractedProps = Omit<MarkedInputProps, 'children' | 'value'>

export type EventName = `on${string}`

export enum Type {
    Change,
    Delete,
    CheckTrigger,
    ClearTrigger,
    Select,
}

export type Payload = {
    key: number,
    value?: Mark
}

export type Trigger = {
    /**
     * Found value via a trigger
     */
    value: string,
    /**
     * Triggered value
     */
    source: string,
    /**
     * Piece of text, in which was a trigger
     */
    span: string,
    /**
     * Html element, in which was a trigger
     */
    node: Node,
    /**
     * Start position of a trigger
     */
    index: number,
    /**
     * Trigger's option
     */
    option: OptionType
}

export type KeyMapper = {
    "TextRef": RefObject<HTMLDivElement>,
    "TriggerSpanRef": RefObject<HTMLElement>,
}

export type Listener = (e: any) => void

type EventsFrom<Type extends object> = {
    [Key in keyof Type & `on${string}`]+?: Type[Key]
};

export type DivEvents = EventsFrom<JSX.IntrinsicElements['div']>

export type Activator = () => void

