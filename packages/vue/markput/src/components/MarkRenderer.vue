<script setup lang="ts">
import {inject, computed, type Ref, type Component} from 'vue'
import type {MarkToken} from '@markput/core'
import {useStore} from '../lib/hooks/useStore'
import {TOKEN_KEY} from '../lib/providers/tokenKey'
import type {MarkProps, Option} from '../types'
// eslint-disable-next-line import/no-cycle
import Token from './Token.vue'

const store = useStore()
const tokenRef = inject(TOKEN_KEY)!
const node = tokenRef.value as MarkToken
const optionsRef = store.state.options.use() as Ref<Option[] | undefined>
const MarkRef = store.state.Mark.use() as Ref<Component | undefined>
const OverlayRef = store.state.Overlay.use() as Ref<Component | undefined>
const key = store.key

const resolved = computed(() => {
	const options = optionsRef.value
	const option = options?.[node.descriptor.index]

	const markPropsData: MarkProps = {
		value: node.value,
		meta: node.meta,
		nested: node.nested?.content,
	}

	const optionConfig = option?.mark
	let props: any

	if (optionConfig !== undefined) {
		if (typeof optionConfig === 'function') {
			props = optionConfig(markPropsData)
		} else {
			props = optionConfig
		}
	} else {
		props = markPropsData
	}

	const globalComponent = MarkRef.value
	const Comp = (props.slot || globalComponent) as Component

	if (!Comp) {
		throw new Error('No mark component found. Provide either option.mark.slot or global Mark component.')
	}

	return {Comp, props}
})
</script>

<template>
	<component :is="resolved.Comp" v-bind="resolved.props">
		<Token v-for="child in node.children" :key="key.get(child)" :mark="child" :is-nested="true" />
	</component>
</template>
