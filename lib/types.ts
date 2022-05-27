import {PLACEHOLDER} from "./constants";
import {ReactElement} from "react";
import {OptionProps} from "./Option";
import {MarkedInputProps} from "./MarkedInput";
import {Caret} from "./hooks/useCaret";
import {Focus} from "./hooks/useFocus";

export type Mark<T> = {
    id: string
    value: string
    props: T
    childIndex: number
}

type id = `${string}${PLACEHOLDER.Id}${string}`
type value = `${string}${PLACEHOLDER.Value}${string}`
export type Markup = `${value}${id}` | `${value}` //| `${id}${value}`

//TODO T to unknown?
export type PassedOptions<T> = ReactElement<OptionProps<T>> | ReactElement<OptionProps<T>>[]

export type Configs<T> = OptionProps<T>[]

export type Slice<T> = string | Mark<T>

export type SliceMap<T> = Map<number, Slice<T>>

export type Match = {
    annotation: string;
    id: string;
    value: string
    index: number;
    input: string;
    childIndex: number;
}

export type Store = {
    props: MarkedInputProps<any>
    configs: Configs<any>
    caret: Caret
    focus: Focus
    sliceMap: SliceMap<any>
    dispatch: Dispatch
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