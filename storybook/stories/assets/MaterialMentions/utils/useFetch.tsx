import {useEffect, useState} from "react"

export const useFetch = <T, >(url: string, deps: unknown[]) => {
    const [data, setData] = useState<T | null>(null)

    useEffect(() => {
        const abortController = new AbortController()
        fetch(url, {signal: abortController.signal})
            .then(res => res.json())
            .then(setData)
        //.catch(reason => console.error(reason))

        return () => abortController.abort()
    }, deps)

    return [data]
}