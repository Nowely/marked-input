import {useMemo} from "react";
import {Caret} from "../../../utils/Caret";

export const useCaret = () => useMemo(() => new Caret(), [])