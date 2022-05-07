import {useState} from "react";

export type CaretManager = {
    toStart: () => void;
    toEnd: () => void;
    clear: () => void;
    position: number;
    isStart: boolean;
    isEnd: boolean;
    isBlurred: boolean;
    isInteger: boolean;
    setPosition: (value: (((prevState: (number)) => (number)) | number)) => void
}

//TODO
export const useCaret = (): CaretManager => {
    const [position, setPosition] = useState<number>(Number.NaN)

    const toStart = () => {
        setPosition(Number.NEGATIVE_INFINITY)
    }

    const toEnd = () => {
        setPosition(Number.POSITIVE_INFINITY)
    }

    const clear = () => {
        setPosition(Number.NaN)
    }

    const restore = () => {

    }

    const isStart = position === Number.NEGATIVE_INFINITY
    const isEnd = position === Number.POSITIVE_INFINITY
    const isBlurred = Number.isNaN(position)
    const isInteger = Number.isInteger(position)

    return {toStart, toEnd, clear, position, setPosition, isEnd, isBlurred, isInteger, isStart}
}