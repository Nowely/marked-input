import {setProjectAnnotations} from '@storybook/react-vite'

import {withPlainValue} from './src/shared/lib/withPlainValue.react'

setProjectAnnotations({
	decorators: [withPlainValue],
})