import {setProjectAnnotations} from '@storybook/vue3-vite'

import {withPlainValue} from './src/shared/lib/withPlainValue.vue'

setProjectAnnotations({
	decorators: [withPlainValue],
})