import {useRecoveryAfterRemove} from "./hooks/useRecoveryAfterRemove";
import {useTextElements} from "./hooks/useTextElements";
import {useFocusedElement} from "./hooks/useFocusedElement";
import {useKeyDown} from "./hooks/useKeyDown";
import {useFocusOnEmptyInput} from "./hooks/useFocusOnEmptyInput";

export const useFocus = () => {
    const {elements, register} = useTextElements()
    const focusedElement = useFocusedElement()
    const recoveryRef = useRecoveryAfterRemove(elements)
    useKeyDown(elements, recoveryRef, focusedElement)
    useFocusOnEmptyInput(elements)

    return {register}
}