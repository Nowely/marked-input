import {useListener} from "../../../../../utils/useListener";
import {useValue} from "../../../../../utils";

export const useFocusOnEmptyInput = () => {
    const list = useValue()
    useListener("onClick", () => {
        if (list.length === 1 && list.head?.data.piece === "")
            list.head?.data.ref?.current?.focus()
    }, [])
};