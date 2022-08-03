import {PLACEHOLDER} from "./constants";
import {ReactElement} from "react";
import {OptionProps} from "../Option";
import {MarkedInputProps} from "./MarkedInput";

//TODO rename ParsedMarkup, Match?
export type Mark = {
    annotation: string;
    id: string;
    value: string
    index: number;
    input: string;
    childIndex: number;
}

export interface OverlayProps {
    left: number
    top: number
    onClose: Function
    word: string
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
    props: MarkedInputProps<any, any>
    configs: Configs<any>
    sliceMap: SliceMap<any>
    dispatch: Dispatch
    //TODO type
    trigger: {word: string | undefined, check: () => void, clear: () => void, configRef: React.MutableRefObject<OptionProps<any, any> | undefined>}
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