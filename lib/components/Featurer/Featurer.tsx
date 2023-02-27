import {useContainerEvents} from "./hooks/useContainerEvents";
import {useSystemListeners} from "./hooks/useSystemListeners";
import {useValueParser} from "./hooks/useValueParser";
import {MarkedInputProps} from "../MarkedInput";
import {useStateUpdating} from "./hooks/useStateUpdating";
import {useFocusedNode} from "./hooks/useFocusedNode";
import {useKeyDown} from "./hooks/useKeyDown";
import {useFocusOnEmptyInput} from "./hooks/useFocusOnEmptyInput";
import {useCheckTriggerOnSelectionChange} from "./hooks/useCheckTriggerOnSelectionChange";
import {useTrigger} from "./hooks/useTrigger";
import {useCloseOverlayByEsc} from "./hooks/useCloseOverlayByEsc";
import {useCloseOverlayByOutsideClick} from "./hooks/useCloseOverlayByOutsideClick";
import {useFocusRecovery} from "./hooks/useFocusRecovery";

export const Featurer = ({props}: { props: MarkedInputProps<any> }) => {
    useStateUpdating(props)
    useContainerEvents()
    useSystemListeners()
    useValueParser()

    useFocusedNode()
    useKeyDown()
    useFocusOnEmptyInput()
    useFocusRecovery()

    useTrigger()
    useCheckTriggerOnSelectionChange()

    useCloseOverlayByEsc()
    useCloseOverlayByOutsideClick()

    return null
}

