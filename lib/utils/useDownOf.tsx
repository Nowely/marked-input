import {DependencyList, KeyboardEvent} from "react"
import {KEY} from "../constants"
import {useListener} from "./useListener"

export function useDownOf(key: KEY, callback: (event: KeyboardEvent<HTMLSpanElement>) => void, deps: DependencyList = []) {
    useListener("onKeyDown", (event) => {
        if (event.key === key) callback(event)
    }, deps)
}