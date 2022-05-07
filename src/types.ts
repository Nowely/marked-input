export type TagValue<T> = {
    id: string
    value: string
    props: T
    valueKey: string
    childIndex: number
}