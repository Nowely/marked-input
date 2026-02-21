import {useEffect, useState} from 'react'

export const useFetch = <T,>(url: string, deps: unknown[]) => {
	const [data, setData] = useState<T | null>(null)

	useEffect(() => {
		const abortController = new AbortController()
		fetch(url, {signal: abortController.signal})
			.then(res => res.json())
			.then(setData)
			.catch(error => {
				// Ignore aborts triggered during cleanup to avoid noisy test errors.
				if ((error as DOMException)?.name === 'AbortError') return
				console.error(error)
			})

		return () => abortController.abort()
	}, deps)

	return [data]
}
