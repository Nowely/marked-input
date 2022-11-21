import {useRecoveryAfterRemove} from "./hooks/useRecoveryAfterRemove";
import {useFocusedNodeRef} from "./hooks/useFocusedNodeRef";
import {useKeyDown} from "./hooks/useKeyDown";
import {useFocusOnEmptyInput} from "./hooks/useFocusOnEmptyInput";

export const useFocus = () => {
    useFocusedNodeRef()
    useRecoveryAfterRemove()
    useKeyDown()
    useFocusOnEmptyInput()
}