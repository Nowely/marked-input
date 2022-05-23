import path from "path";
import {defineConfig} from "vite";
import {MarkedInput} from "./lib";
import dts from 'vite-plugin-dts';
import react from '@vitejs/plugin-react';

export default defineConfig({
    build: {
        sourcemap: true,
        lib: {
            entry: path.resolve(__dirname, 'lib/index.ts'),
            name: MarkedInput.name,
            formats: ['es', 'umd'],
        },
        rollupOptions: {
            external: ['react'],
            output: {
                globals: {
                    react: 'React'
                }
            }
        }
    },
    plugins: [react(), dts({
        outputDir: "dist/types"
    })]
})