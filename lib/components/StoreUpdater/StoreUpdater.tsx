import {useContainerEvents} from "./hooks/useContainerEvents";
import {useSystemListeners} from "./hooks/useSystemListeners";
import {useValueParser} from "./hooks/useValueParser";
import {MarkedInputProps} from "../MarkedInput";
import {useStateUpdating} from "./hooks/useStateUpdating";

//TODO centralize listeners in here?
//TODO rename
export const StoreUpdater = ({props}: { props: MarkedInputProps<any, any> }) => {
    useStateUpdating(props)
    useContainerEvents()
    useSystemListeners()
    useValueParser()
    return null
}

