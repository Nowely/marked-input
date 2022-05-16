import {PLACEHOLDER} from "./constants";
import {ReactElement} from "react";
import {OptionProps} from "./Option";

export type Mark<T> = {
    id: string
    value: string
    props: T
    childIndex: number
}

type id = `${string}${PLACEHOLDER.Id}${string}`
type value = `${string}${PLACEHOLDER.Value}${string}`
export type Markup = `${value}${id}` | `${id}${value}` | `${id}`

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