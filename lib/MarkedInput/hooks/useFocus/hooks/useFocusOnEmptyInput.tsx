import {RefObject, useEffect} from "react";
import {useStore} from "../../../utils";

export const useFocusOnEmptyInput = (registered: Map<number, RefObject<HTMLSpanElement>>) => {
    const {bus} = useStore()

    useEffect(() => bus.listen("onClick", () => {
        if (registered.size === 1) {
            const element = [...registered.values()][0].current
            if (element?.textContent === "") {
                element.focus()
            }
        }
    }), [])
};