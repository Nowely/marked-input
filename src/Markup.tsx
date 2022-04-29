export interface MarkupProps<T = Record<string, any>> {
    value: string
    trigger?: string //| RegExp
    inner: T
}

export const Markup = <T,>(props: MarkupProps<T>) => null