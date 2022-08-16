import {MarkedInput} from "../../../lib";

const concat = (...str: string[]) => str.reduce((acc, curren) => acc += "/" + curren)

export const getTitle = (...str: string[]) => concat(MarkedInput.name, ...str)

export const getTitleOfStyled = (...str: string[]) => concat(MarkedInput.name, "Styled", ...str)