import {useRecoveryAfterRemove} from "./hooks/useRecoveryAfterRemove";
import {useFocusedSpanRef} from "./hooks/useFocusedSpanRef";
import {useKeyDown} from "./hooks/useKeyDown";
import {useFocusOnEmptyInput} from "./hooks/useFocusOnEmptyInput";

export const useFocus = () => {
    const focusedSpanRef = useFocusedSpanRef()
    const recoveryRef = useRecoveryAfterRemove()
    useKeyDown(recoveryRef, focusedSpanRef)
    useFocusOnEmptyInput()
}