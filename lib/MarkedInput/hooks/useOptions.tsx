import {OverlayProps, ElementOptions} from "../types";
import {useMemo} from "react";
import {extractOptions} from "../utils";
import {OptionProps} from "../../Option";

export const useOptions = (children: ElementOptions<any> | OptionProps[]) =>
    useMemo(() => extractOptions(children), [children])