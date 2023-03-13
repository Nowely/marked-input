import {MarkedInput} from "rc-marked-input"

const concat = (...str: string[]) => str.reduce((acc, curren) => acc += "/" + curren)

export const getTitle = (...str: string[]) => concat(MarkedInput.displayName!, ...str)