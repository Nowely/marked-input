import {PassedOptions} from "../types";
import {useMemo} from "react";
import {extractConfigs} from "../utils";

export const useConfigs = (children: PassedOptions<any>) =>
    useMemo(() => extractConfigs(children), [children])