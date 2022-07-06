import {PLACEHOLDER} from "./constants";
import {ReactElement} from "react";
import {OptionProps} from "../Option";
import {MarkedInputProps} from "./MarkedInput";
import {Caret} from "./hooks/useCaret";

export type Mark = {
    annotation: string;
    id: string;
    value: string
    index: number;
    input: string;
    childIndex: number;
}

type id = `${string}${PLACEHOLDER.Id}${string}`
type value = `${string}${PLACEHOLDER.Value}${string}`

export type Markup = `${value}${id}` | `${value}` //| `${id}${value}`

//TODO T to unknown?
export type PassedOptions<T> = ReactElement<OptionProps<T>> | ReactElement<OptionProps<T>>[]

export type Configs<T> = OptionProps<T>[]

export type Slice<T> = string | Mark

export type SliceMap<T> = Map<number, Slice<T>>

export type Store = {
    props: MarkedInputProps<any>
    configs: Configs<any>
    caret: Caret
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