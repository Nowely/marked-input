import {PLACEHOLDER} from "./constants";
import {FunctionComponent, RefObject} from "react";
import {MarkedInputProps} from "./components/MarkedInput";
import LinkedList from "./utils/LinkedList";

export type NodeData = {
    key: number
    mark: Mark
    ref: RefObject<HTMLElement>
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

/** Piece of marked text: fragment of text or mark definition */
export type Piece = string | AnnotatedMark

export type KeyedPieces = Map<number, Piece>

type PartialPick<T, F extends keyof T> = Omit<Required<T>, F> & Partial<Pick<T, F>>

export type OptionType = PartialPick<OptionProps, "initMark"> & { index: number }

export type Options = OptionType[]

//TODO rename to options
export interface OptionProps<T = Record<string, any>> {
    /**
     * Template string instead of which the mark is rendered.
     * Must contain placeholders: `__label__` and optional `__value__`
     * @Default "@[__label__](__value__)"
     */
    markup?: Markup
    /**
     * Sequence of symbols for calling the overlay.
     * @Default "@"
     */
    trigger?: string //| RegExp
    /**
     * Data for an overlay component. By default, it is suggestions.
     */
    data?: string[] //TODO | object[]
    /**
     * Function to initialize props for the mark component. Gets arguments from found markup
     */
    initMark?: (props: MarkProps) => T
}

export type ConfiguredMarkedInputProps<T> = Omit<MarkedInputProps<T>, "Mark" | "Overlay" | "options">
export type ConfiguredMarkedInput<T> = FunctionComponent<ConfiguredMarkedInputProps<T>>

export type State = Omit<MarkedInputProps<any>, 'options'> & {
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

export interface MarkedInputHandler {
    /**
     * Container element
     */
    readonly container: HTMLDivElement | null
    /**
     * Overlay element if exists
     */
    readonly overlay: HTMLElement | null

    focus(): void
}