import {DecoratorFunction} from "@storybook/csf/dist/story";
import {useInsertionEffect} from "react";

export const withCSS = (href: string): DecoratorFunction<any, any> =>
    (Story) => {
        useStyleInsertion(href)
        return <Story/>;
    }

const useStyleInsertion = (href: string) => {
    useInsertionEffect((): () => void => {
        const head = document.getElementsByTagName('HEAD')[0]
        const link = document.createElement('link')

        link.rel = 'stylesheet'
        link.type = 'text/css'
        link.href = href

        head.appendChild(link)
        return () => head.removeChild(link)
    }, [])
}
