import {EventName, Listener, Type} from "../types";
import {DependencyList, useEffect} from "react";
import {useStore} from "./index";
import {Store} from "./useSelector";

export function useListener(type: EventName | Type, listener: Listener, deps?: DependencyList, store?: Store) {
    const {bus} = store ?? useStore()
    useEffect(() => bus.listen(type, listener), deps)
}