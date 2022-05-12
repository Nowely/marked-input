import {PLACEHOLDER} from "./constants";

export type Mark<T> = {
    id: string
    value: string
    props: T
    childIndex: number
}

type id = `${string}${PLACEHOLDER.Id}${string}`
type value = `${string}${PLACEHOLDER.Value}${string}`
export type Markup = `${value}${id}` | `${id}${value}` | `${id}`