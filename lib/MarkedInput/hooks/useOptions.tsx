import {OverlayProps, PassedOptions} from "../types";
import {useMemo} from "react";
import {extractOptions} from "../utils";
import {OptionProps} from "../../Option";

export const useOptions = (children: PassedOptions<any> | OptionProps[]) =>
    useMemo(() => extractOptions(children), [children])