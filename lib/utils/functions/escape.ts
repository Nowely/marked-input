// escape RegExp special characters https://stackoverflow.com/a/9310752/5142490
export const escape = (str: string) => str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')