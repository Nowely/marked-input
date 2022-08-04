import {PassedOptions} from "../types";
import {useMemo} from "react";
import {extractOptions} from "../utils";

export const useOptions = (children: PassedOptions<any>) =>
    useMemo(() => extractOptions(children), [children])