import {ComponentType, ForwardedRef, forwardRef} from "react";
import {assign} from "./index";
import {_MarkedInput, MarkedInputProps} from "../components/MarkedInput";
import {ConfiguredMarkedInput, ConfiguredMarkedInputProps, MarkStruct, OptionProps} from "../types";

/**
 * Create the configured MarkedInput component.
 */
export function createMarkedInput<T = MarkStruct>(Mark: ComponentType<T>, options?: OptionProps<T>[]): ConfiguredMarkedInput<T>;
export function createMarkedInput<T = MarkStruct>(Mark: ComponentType<T>, Overlay: ComponentType, options?: OptionProps<T>[]): ConfiguredMarkedInput<T>;
export function createMarkedInput(
    Mark: ComponentType<any>,
    optionsOrOverlay: ComponentType<any> | OptionProps[] | undefined,
    options?: OptionProps[]
): ConfiguredMarkedInput<any> {
    const predefinedProps = Array.isArray(optionsOrOverlay) ? {
        Mark,
        options: optionsOrOverlay,
    } : {
        Mark,
        Overlay: optionsOrOverlay,
        options
    }

    const ConfiguredMarkedInput = (props: ConfiguredMarkedInputProps<any>, ref: ForwardedRef<any>) => {
        const assignedProps: MarkedInputProps<any> = assign({}, props, predefinedProps)
        return _MarkedInput(assignedProps, ref)
    }

    return forwardRef(ConfiguredMarkedInput)
}