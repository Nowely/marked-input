import type {Component} from 'vue'
import {defineComponent, h} from 'vue'

/**
 * Helper to create a wrapper component that renders a story with custom props
 * This allows overriding story args in tests
 */
export function withProps(story: Component, props: Record<string, unknown>) {
	return defineComponent({
		setup(_, {slots}) {
			return () => h(story, props, slots)
		},
	})
}