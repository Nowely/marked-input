import {useListener} from "../../../../../utils/useListener";
import {useProps} from "../../../../../utils/useProps";

export const useFocusOnEmptyInput = () => {
    const pieces = useProps(state => state.pieces)
    useListener("onClick", () => {
        if (pieces.length === 1 && pieces.head?.data.mark.label === "")
            pieces.head?.data.ref?.current?.focus()
    }, [pieces])
};