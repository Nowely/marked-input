import {ComponentType} from "react";
import {assign} from "./index";
import {MarkedInput, MarkedInputProps} from "../components/MarkedInput";
import {ConfiguredMarkedInput, ConfiguredMarkedInputProps, Mark, OptionProps} from "../types";

/**
 * Create the configured MarkedInput component.
 */
export function createMarkedInput<T = Mark>(Mark: ComponentType<T>, options?: OptionProps<T>[]): ConfiguredMarkedInput<T>;
export function createMarkedInput<T = Mark>(Mark: ComponentType<T>, Overlay: ComponentType, options?: OptionProps<T>[]): ConfiguredMarkedInput<T>;
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

    return function ConfiguredMarkedInput(props: ConfiguredMarkedInputProps<any>) {
        const assignedProps: MarkedInputProps<any> = assign({}, props, predefinedProps)
        return MarkedInput(assignedProps)
    }
}