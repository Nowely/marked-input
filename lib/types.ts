import {PLACEHOLDER} from "./constants";
import {FunctionComponent, ReactElement, RefObject} from "react";
import {OptionProps} from "./components/Option";
import {MarkedInputProps} from "./components/MarkedInput";
import LinkedList from "./utils/LinkedList";

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
export interface AnnotatedMark extends Mark {
    annotation: string;
    label: string;
    value: string
    index: number;
    input: string;
    childIndex: number;
}

//TODO
export interface MarkProps extends Mark {
    //useMark: () => ReturnType<typeof useMark>
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

export type OptionType = PartialPick<OptionProps, "initMark"> & { index: number }

export type Options = OptionType[]

export type ConfiguredMarkedInputProps<T> = Omit<MarkedInputProps<T>, "Mark" | "Overlay" | "children">
export type ConfiguredMarkedInput<T> = FunctionComponent<ConfiguredMarkedInputProps<T>>

export type State = Omit<MarkedInputProps<any>, 'children'> & {
    options: Options,
    pieces: LinkedList<NodeData>,
    trigger?: Trigger,
}

export type EventName = `on${string}`

export enum Type {
    Change,
    Delete,
    CheckTrigger,
    ClearTrigger,
    Trigger,
    Select,
    State
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

export type Listener = (e: any) => void

type EventsFrom<Type extends object> = {
    [Key in keyof Type & `on${string}`]+?: Type[Key]
};

export type DivEvents = EventsFrom<JSX.IntrinsicElements['div']>

export type Activator = () => void

export type Recovery = {
    prevNodeData?: NodeData
    caretPosition: number
    isPrevPrev?: boolean
}