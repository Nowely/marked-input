/**
* Convert milliseconds into operations per second
*/
export const convertMsIntoFrequency = (value: number) => 1 / (value / 1000)