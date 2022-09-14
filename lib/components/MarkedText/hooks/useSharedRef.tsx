import {useStore} from "../../../utils";
import {useEffect, useRef} from "react";

export function useSharedRef() {
    const {bus} = useStore()
    const ref = useRef<HTMLDivElement>(null)
    useEffect(() => bus.set("TextRef", ref), [])
    return ref;
}