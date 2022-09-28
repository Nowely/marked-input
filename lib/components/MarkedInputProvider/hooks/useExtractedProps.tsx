import {MarkedInputProps} from "../../MarkedInput";
import {ExtractedProps} from "../../../types";
import {useMemo} from "react";

export function useExtractedProps(props: MarkedInputProps<any, any>): ExtractedProps {
    const {value, children, ...other} = props
    const {Overlay, spanStyle, spanClassName, style, className, readOnly, onChange, Mark} = other

    return useMemo(() => {
        return other
    }, [Overlay, spanStyle, spanClassName, style, className, readOnly, onChange, Mark])
}
