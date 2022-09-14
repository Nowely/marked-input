import {useRecoveryAfterRemove} from "./hooks/useRecoveryAfterRemove";
import {useSpanRefs} from "./hooks/useSpanRefs";
import {useFocusedSpanRef} from "./hooks/useFocusedSpanRef";
import {useKeyDown} from "./hooks/useKeyDown";
import {useFocusOnEmptyInput} from "./hooks/useFocusOnEmptyInput";

export const useFocus = () => {
    const {spanRefs, register} = useSpanRefs()
    const focusedSpanRef = useFocusedSpanRef()
    const recoveryRef = useRecoveryAfterRemove(spanRefs)
    useKeyDown(spanRefs, recoveryRef, focusedSpanRef)
    useFocusOnEmptyInput(spanRefs)

    return {register}
}