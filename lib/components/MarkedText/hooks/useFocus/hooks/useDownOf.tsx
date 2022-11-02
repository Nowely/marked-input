import {KEY} from "../../../../../constants";
import {KeyboardEvent} from "react";
import {useListener} from "../../../../../utils/useListener";

export function useDownOf(key: KEY, callback: (event: KeyboardEvent<HTMLSpanElement>) => void) {
    useListener("onKeyDown", (event) => {
        if (event.key === key) callback(event)
    }, [])
}