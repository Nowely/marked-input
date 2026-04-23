import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import {defineConfig} from 'vite'

export default defineConfig({
	plugins: process.env.FRAMEWORK === 'react' ? [react()] : [vue()],
	define: {'process.env.FRAMEWORK': JSON.stringify(process.env.FRAMEWORK ?? '')},
})