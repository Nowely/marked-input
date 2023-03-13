import {DecoratorFunction} from "@storybook/csf/dist/story"
import {useInsertionEffect} from "react"

//TODO load css on startup
export const withStyle = (id: string): DecoratorFunction<any, any> =>
    (Story) => {
        useStyleInsertion(id)
        return <Story/>
    }

const useStyleInsertion = (id: string) =>
    useInsertionEffect((): () => void => {
        const link = document.getElementById(id) as HTMLLinkElement

        if (!link) throw new Error(`The style ${id} is not found!`)

        link.disabled = false
        return () => link.disabled = true
    }, [])
