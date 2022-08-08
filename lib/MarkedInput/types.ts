import {PLACEHOLDER} from "./constants";
import {ComponentType, FunctionComponent, ReactElement} from "react";
import {OptionProps} from "../Option";
import {MarkedInputProps} from "./MarkedInput";
import {Trigger} from "./hooks/useTrigger";

//TODO rename ParsedMarkup, Match?
export type Mark = {
    annotation: string;
    label: string;
    value: string
    index: number;
    input: string;
    childIndex: number;
}

export interface OverlayProps {
    style: {
        left: number
        top: number
    }
    //onClose: Function
    onSelect: onSelect
    data: string[] //| object[]
    word: string
}

export interface MarkProps {
    label: string
    value: string
}

export type onSelect = ({label, value}: { label: string, value: string }) => void

type label = `${string}${PLACEHOLDER.LABEL}${string}`
type value = `${string}${PLACEHOLDER.VALUE}${string}`

export type Markup = `${label}${value}` | `${label}`

//TODO T to unknown?
export type ElementOptions<T> = ReactElement<OptionProps<T>> | ReactElement<OptionProps<T>>[]

export type Slice<T> = string | Mark

export type SliceMap<T> = Map<number, Slice<T>>

type PartialPick<T, F extends keyof T> = Omit<Required<T>, F> & Partial<Pick<T, F>>

export type OptionType = PartialPick<OptionProps, "initMark" | "initOverlay">

export type Options = OptionType[]

export type ConfiguredMarkedInputProps<T, T1 = OverlayProps> = Omit<MarkedInputProps<T, T1>, "Mark" | "Overlay" | "children">
export type ConfiguredMarkedInput<T, T1 = OverlayProps> = FunctionComponent<ConfiguredMarkedInputProps<T, T1>>

export type Store = {
    props: MarkedInputProps<any, any>
    options: Options
    sliceMap: SliceMap<any>
    dispatch: Dispatch
    //TODO type
    trigger: Trigger
}

//TODO naming
export type Dispatch = (type: Type, payload: Payload) => void

export enum Type {
    Change,
    Delete
}

export type Action = {
    type: Type,
    payload: Payload
}
export type Payload = {
    key: number,
    value?: Slice<any>
}