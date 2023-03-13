import {Tag} from 'antd'
import {MarkedInput} from 'rc-marked-input'
import {useState} from 'react'
import {getTitle} from './assets/getTitle'
import {Text} from './assets/Text'
import {withStyle} from './assets/withStyle'

export default {
    title: getTitle('Ant'),
    component: MarkedInput,
    decorators: [withStyle('antd.min.css')]
}

export const Tagged = () => {
    const [value, setValue] = useState(
        `We preset five different colors. You can set color property such as @(success), @(processing), @(error), @(default) and @(warning) to show specific status.`
    )

    return <>
        <MarkedInput Mark={Tag} value={value} onChange={setValue} options={[{
            markup: '@(__label__)',
            initMark: ({label}) => ({children: label, color: label, style: {marginRight: 0}})
        }]}/>

        <Text label="Plaint text:" value={value}/>
    </>
}