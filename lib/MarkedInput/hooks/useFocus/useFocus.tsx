import {useRecoveryAfterRemove} from "./hooks/useRecoveryAfterRemove";
import {useRegistration} from "./hooks/useRegistration";
import {useFocusedElement} from "./hooks/useFocusedElement";
import {useKeyDown} from "./hooks/useKeyDown";

//TODO. Refactor triggers listeners
//TODO. Refactor onClick handler
export const useFocus = (check: () => void, clear: () => void) => {
    const {registered, register} = useRegistration()
    const focusedElement = useFocusedElement()
    const recoveryRef = useRecoveryAfterRemove(registered)
    useKeyDown(registered, recoveryRef, focusedElement)

    return {
        register,
        /*onFocus: (event: FocusEvent<HTMLElement>) => {
            document.addEventListener("selectionchange", check)
        },
        onBlur: () => {
            document?.removeEventListener("selectionchange", check);
            //TODO. It is for overlay click correct handling
            setTimeout(_ => clear(), 200)
        },*/
        onClick: () => {
            if (registered.size === 1) {
                const element = [...registered.values()][0].current
                if (element?.textContent === "") {
                    element.focus()
                }
            }
        },
    }
}

